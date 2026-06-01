import logging
import os
import random
from typing import Optional, List
from urllib.parse import urlparse

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from pydantic import BaseModel, Field
from supabase import create_client, Client

load_dotenv()
logger = logging.getLogger("nexusai")

# ── Supabase clients ──────────────────────────────────────────────────────────

def _get_supabase_anon() -> Optional[Client]:
    """Cliente con anon key — respeta RLS (solo lectura pública)."""
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        return None
    return create_client(url, key)

def _get_supabase_admin() -> Optional[Client]:
    """Cliente con service_role key — bypasa RLS para operaciones de servidor."""
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        return None
    return create_client(url, key)

# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="NexusAI — Backend Orquestador",
    description="API principal: generación IA, scraping LinkedIn, gestión de leads y campañas.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # chrome-extension:// + localhost + producción
    allow_methods=["*"],
    allow_headers=["*"],
)

CLAUDE_MODEL = "claude-sonnet-4-6"

# ── Schemas Pydantic ──────────────────────────────────────────────────────────

class GenerateMessageRequest(BaseModel):
    lead_profile: str = Field(..., min_length=1)
    tone: str = Field("consultivo", description="formal | consultivo | amigable | directo")
    objective: str = Field("agendar_reunion", description="agendar_reunion | calificar | propuesta")

class AISuggestRequest(BaseModel):
    conversation_history: List[dict] = Field(..., description="Lista de {sender, text}")
    lead_name: str = Field("", description="Nombre del lead")
    lead_company: str = Field("", description="Empresa del lead")
    pipeline_stage: str = Field("en_contacto", description="Etapa actual del lead")

class ScrapeRequest(BaseModel):
    url: str = Field(..., min_length=1)

class AuthScrapeRequest(BaseModel):
    url: str = Field(..., min_length=1)
    session_cookie: str = Field(default="", description="Cookie li_at de LinkedIn (vacío = usar la guardada en el engine)")

class ActivityRequest(BaseModel):
    action_type: str = Field(..., description="message_sent | connection_sent | meeting_booked | etc.")
    lead_name: Optional[str] = None
    lead_url: Optional[str] = None
    campaign_id: Optional[str] = None
    li_account: Optional[str] = None
    workspace_id: Optional[str] = None
    metadata: Optional[dict] = None

class LeadCreateRequest(BaseModel):
    full_name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    headline: Optional[str] = None
    status: str = "nuevo"
    value: int = 0
    workspace_id: Optional[str] = None
    campaign_id: Optional[str] = None

class LeadUpdateRequest(BaseModel):
    status: Optional[str] = None
    value: Optional[int] = None
    next_task: Optional[str] = None
    ai_summary: Optional[str] = None

# ── Utils ──────────────────────────────────────────────────────────────────────

def get_anthropic_client() -> Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "tu_clave_aqui":
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY no configurada. Edita backend/.env con tu clave real.",
        )
    return Anthropic(api_key=api_key)

def parse_profile_field(profile_text: str, label: str) -> str:
    for line in profile_text.splitlines():
        if line.strip().startswith(f"{label}:"):
            return line.split(":", 1)[1].strip()
    return ""

# ── ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    supabase_ok = _get_supabase_admin() is not None
    anthropic_ok = bool(os.getenv("ANTHROPIC_API_KEY"))
    return {
        "status": "ok",
        "version": "2.0.0",
        "services": {
            "anthropic": "configured" if anthropic_ok else "missing_key",
            "supabase":  "configured" if supabase_ok else "missing_credentials",
        },
    }

# ── Generate message with Claude ──────────────────────────────────────────────

@app.post("/api/generate-message")
def generate_message(data: GenerateMessageRequest):
    client = get_anthropic_client()

    tone_guide = {
        "formal":     "Usa un lenguaje formal y profesional.",
        "consultivo": "Usa un tono consultivo y empático, como un asesor experto.",
        "amigable":   "Usa un tono cercano, amigable y directo.",
        "directo":    "Sé muy directo al grano, sin rodeos.",
    }
    objective_guide = {
        "agendar_reunion": "El objetivo es lograr una reunión o demo de 20-30 minutos.",
        "calificar":       "El objetivo es calificar si el lead tiene necesidad y presupuesto.",
        "propuesta":       "El objetivo es despertar interés para enviar una propuesta formal.",
    }

    system = f"""Eres un experto en ventas B2B de SaaS. Redacta un mensaje de conexión de LinkedIn.
Reglas:
- Máximo 3 oraciones. Sin saludos genéricos. Sin emojis excesivos.
- Personaliza mencionando algo específico del perfil del lead.
- {tone_guide.get(data.tone, tone_guide['consultivo'])}
- {objective_guide.get(data.objective, objective_guide['agendar_reunion'])}
- Solo devuelve el texto del mensaje, sin explicaciones adicionales."""

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            system=system,
            messages=[{"role": "user", "content": f"Perfil del lead:\n\n{data.lead_profile}"}],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error Anthropic API: {exc}") from exc

    generated = "".join(
        b.text for b in response.content if hasattr(b, "text") and b.type == "text"
    ).strip()

    if not generated:
        raise HTTPException(status_code=502, detail="Claude no devolvió contenido.")

    # Guardar lead en Supabase (solo si hay service_role key)
    supabase = _get_supabase_admin()
    if supabase:
        try:
            name = parse_profile_field(data.lead_profile, "Nombre")
            headline = parse_profile_field(data.lead_profile, "Titular")
            url = parse_profile_field(data.lead_profile, "URL")
            if name and name != "No encontrado":
                supabase.table("leads").insert({
                    "full_name":    name,
                    "headline":     headline or None,
                    "linkedin_url": url or None,
                    "ai_summary":   generated,
                    "status":       "nuevo",
                    "value":        0,
                }).execute()
        except Exception as exc:
            logger.warning("Supabase insert lead falló (mensaje igual se devuelve): %s", exc)

    return {"message": generated, "tone": data.tone, "objective": data.objective}

# ── AI Suggest — Copiloto del Smart Inbox ─────────────────────────────────────

@app.post("/api/ai/suggest")
def ai_suggest(data: AISuggestRequest):
    """Genera 3 sugerencias de respuesta para el copiloto del Smart Inbox."""
    client = get_anthropic_client()

    # Construir historial de conversación
    history_text = "\n".join(
        f"{'[Lead]' if m.get('sender') == 'lead' else '[Vendedor]'}: {m.get('text', '')}"
        for m in data.conversation_history[-8:]  # últimos 8 mensajes
    )

    system = """Eres un copiloto de ventas B2B experto. Analiza la conversación y genera exactamente 3 sugerencias de respuesta.

Formato de respuesta (JSON estricto):
{
  "suggestions": [
    {"id": "s1", "intent": "follow_up", "text": "..."},
    {"id": "s2", "intent": "qualify", "text": "..."},
    {"id": "s3", "intent": "schedule", "text": "..."}
  ]
}

Intents disponibles: follow_up, qualify, schedule, value_prop, close
Cada texto máximo 2 oraciones. En español. Sin emojis."""

    prompt = f"""Lead: {data.lead_name} de {data.lead_company}
Etapa: {data.pipeline_stage}

Conversación:
{history_text}

Genera 3 sugerencias de respuesta para el vendedor."""

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=500,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error Anthropic API: {exc}") from exc

    text = "".join(b.text for b in response.content if hasattr(b, "text")).strip()

    # Parsear JSON de Claude
    import json, re
    try:
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return result
    except Exception:
        pass

    # Fallback si el JSON falla
    return {
        "suggestions": [
            {"id": "s1", "intent": "follow_up",  "text": "¿Tuviste oportunidad de revisar lo que te compartí? Me gustaría conocer tu opinión."},
            {"id": "s2", "intent": "qualify",     "text": f"¿Cuántos SDRs tiene el equipo de {data.lead_company} actualmente?"},
            {"id": "s3", "intent": "schedule",    "text": "¿Tienes 20 minutos esta semana para una demo rápida de NexusAI?"},
        ]
    }

# ── Activity log (desde extensión Chrome) ────────────────────────────────────

@app.post("/api/activity")
def log_activity(data: ActivityRequest):
    """Registra una acción ejecutada por el Ghost Engine."""
    supabase = _get_supabase_admin()
    if supabase:
        try:
            supabase.table("activity_log").insert({
                "action_type": data.action_type,
                "description": f"{data.action_type} → {data.lead_name or 'desconocido'}",
                "metadata": {
                    "lead_url":   data.lead_url,
                    "li_account": data.li_account,
                    **(data.metadata or {}),
                },
                **({"campaign_id": data.campaign_id} if data.campaign_id else {}),
                **({"workspace_id": data.workspace_id} if data.workspace_id else {}),
            }).execute()
        except Exception as exc:
            logger.warning("Activity log falló: %s", exc)

    return {"ok": True, "action": data.action_type}

@app.get("/api/activity")
def get_activity(limit: int = 8):
    """Devuelve los últimos registros de actividad para el feed del dashboard."""
    supabase = _get_supabase_admin()
    if not supabase:
        return {"items": [], "count": 0}
    try:
        result = supabase.table("activity_log") \
            .select("id, action_type, description, metadata, created_at") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        return {"items": result.data or [], "count": len(result.data or [])}
    except Exception as exc:
        logger.warning("get_activity falló: %s", exc)
        return {"items": [], "count": 0}

# ── Leads CRUD ────────────────────────────────────────────────────────────────

@app.get("/api/leads")
def get_leads(workspace_id: Optional[str] = None, status: Optional[str] = None, limit: int = 100):
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        query = supabase.table("leads").select("*").limit(limit).order("created_at", desc=True)
        if workspace_id:
            query = query.eq("workspace_id", workspace_id)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return {"leads": result.data, "count": len(result.data)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/leads")
def create_lead(data: LeadCreateRequest):
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        payload = data.model_dump(exclude_none=True)
        result = supabase.table("leads").insert(payload).select().execute()
        return {"lead": result.data[0] if result.data else {}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.patch("/api/leads/{lead_id}")
def update_lead(lead_id: str, data: LeadUpdateRequest):
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        payload = {k: v for k, v in data.model_dump().items() if v is not None}
        if not payload:
            raise HTTPException(status_code=400, detail="Sin campos para actualizar")
        result = supabase.table("leads").update(payload).eq("id", lead_id).execute()
        return {"ok": True, "updated": result.data}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── Campaigns CRUD ────────────────────────────────────────────────────────────

@app.get("/api/campaigns")
def get_campaigns(workspace_id: Optional[str] = None, status: Optional[str] = None):
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        query = supabase.table("campaigns").select("*").order("created_at", desc=True)
        if workspace_id:
            query = query.eq("workspace_id", workspace_id)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return {"campaigns": result.data, "count": len(result.data)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/campaigns")
def create_campaign(data: dict):
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        payload = {
            "name":          data.get("name", "Nueva campaña"),
            "type":          data.get("type", "linkedin"),
            "status":        data.get("status", "draft"),
            "workflow_json": data.get("workflow_json", {}),
            "total_leads":   data.get("total_leads", 0),
            "segment_count": data.get("segment_count", 1),
            **({"workspace_id": data["workspace_id"]} if "workspace_id" in data else {}),
            **({"linkedin_account_id": data["linkedin_account_id"]} if "linkedin_account_id" in data else {}),
        }
        result = supabase.table("campaigns").insert(payload).select().execute()
        return {"campaign": result.data[0] if result.data else {}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.patch("/api/campaigns/{campaign_id}")
def update_campaign(campaign_id: str, data: dict):
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        allowed = ["name", "type", "status", "workflow_json", "total_leads", "segment_count"]
        payload = {k: v for k, v in data.items() if k in allowed}
        if not payload:
            raise HTTPException(status_code=400, detail="Sin campos válidos")
        result = supabase.table("campaigns").update(payload).eq("id", campaign_id).execute()
        return {"ok": True, "updated": result.data}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/campaigns/{campaign_id}/launch")
def launch_campaign(campaign_id: str, data: dict):
    """
    Guarda el flow final, los segmentos y activa/borra la campaña.
    Todo se persiste en workflow_json de la tabla campaigns.
    Body: { flow_config: {nodes, edges}, segments: [...], automation_name, status }
    """
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        # Leer workflow_json actual
        current = supabase.table("campaigns").select("workflow_json").eq("id", campaign_id).execute()
        current_wf: dict = {}
        if current.data:
            current_wf = current.data[0].get("workflow_json") or {}

        segments        = data.get("segments", current_wf.get("segments", []))
        flow_config     = data.get("flow_config", {})   # {nodes, edges}
        automation_name = data.get("automation_name", "")
        status          = data.get("status", "active")

        # Fusionar: preservar lo que ya había + actualizar flow y segmentos
        new_wf = {
            **current_wf,
            "nodes":          flow_config.get("nodes", current_wf.get("nodes", [])),
            "edges":          flow_config.get("edges", current_wf.get("edges", [])),
            "segments":       segments,
            "automation_name": automation_name or current_wf.get("automation_name", ""),
        }

        total_leads = sum(
            s.get("metrics", {}).get("totalLeads", 0)
            for s in segments if isinstance(s, dict)
        )

        result = supabase.table("campaigns").update({
            "status":        status,
            "workflow_json": new_wf,
            "segment_count": len(segments),
            "total_leads":   total_leads,
        }).eq("id", campaign_id).execute()

        return {"ok": True, "status": status, "updated": result.data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── Automations CRUD ─────────────────────────────────────────────────────────

@app.get("/api/automations")
def get_automations(campaign_id: Optional[str] = None, is_template: Optional[bool] = None):
    """
    Los flows se almacenan en workflow_json de campaigns.
    Devuelve campañas con su flow empaquetado como "automations".
    """
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        query = supabase.table("campaigns").select("id,name,status,workflow_json,created_at").order("created_at", desc=True)
        if campaign_id:
            query = query.eq("id", campaign_id)
        result = query.execute()

        automations = []
        for c in (result.data or []):
            wf = c.get("workflow_json") or {}
            nodes = wf.get("nodes", [])
            # Solo incluir campañas que tienen nodos reales (flow configurado)
            if not nodes:
                continue
            is_tpl = is_template  # filtro opcional
            rec = {
                "id":          c["id"],
                "name":        c["name"],
                "flow_config": {"nodes": nodes, "edges": wf.get("edges", [])},
                "is_template": False,
                "status":      c.get("status", "draft"),
                "campaign_id": c["id"],
                "created_at":  c.get("created_at", ""),
            }
            if is_tpl is None or rec["is_template"] == is_tpl:
                automations.append(rec)

        return {"automations": automations, "count": len(automations)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/automations")
def create_automation(data: dict):
    """
    Guarda un flow como plantilla: se guarda en workflow_json de una campaña especial
    con nombre '[Template] ...' y status 'draft'.
    """
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        name        = data.get("name", "Sin nombre")
        flow_config = data.get("flow_config", {})
        is_template = data.get("is_template", False)
        campaign_id = data.get("campaign_id")

        if campaign_id:
            # Actualizar el workflow_json de la campaña existente
            current = supabase.table("campaigns").select("workflow_json").eq("id", campaign_id).execute()
            current_wf = (current.data[0].get("workflow_json") or {}) if current.data else {}
            new_wf = {**current_wf, **flow_config, "is_template": is_template}
            result = supabase.table("campaigns").update({"workflow_json": new_wf}).eq("id", campaign_id).select().execute()
            return {"automation": result.data[0] if result.data else {}}
        else:
            # Crear nueva fila de campaña solo para la plantilla
            result = supabase.table("campaigns").insert({
                "name":          f"[Plantilla] {name}" if is_template else name,
                "status":        "draft",
                "workflow_json": {**flow_config, "is_template": is_template},
                "total_leads":   0,
                "segment_count": 0,
            }).select().execute()
            return {"automation": result.data[0] if result.data else {}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/api/automations/{automation_id}")
def delete_automation(automation_id: str):
    """Los flows se guardan en campaigns — borrar la campaña elimina el flow."""
    supabase = _get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado")
    try:
        supabase.table("campaigns").delete().eq("id", automation_id).execute()
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── Count leads — delegado a la extensión Chrome ──────────────────────────────
# La extensión hace polling a /api/count-leads/pending, abre la URL en LinkedIn
# (ya autenticado), lee el conteo del DOM y lo reporta a /api/count-leads/result.

_pending_count_requests: dict = {}   # url -> {"count": None|int, "done": bool}

@app.post("/api/count-leads")
async def request_count_leads(data: dict):
    """Frontend llama aquí con {url}. Encola la petición y espera hasta 30s."""
    url = data.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url requerida")

    _pending_count_requests[url] = {"count": None, "done": False}

    # Esperar hasta 30s a que la extensión resuelva
    import asyncio
    for _ in range(30):
        await asyncio.sleep(1)
        state = _pending_count_requests.get(url, {})
        if state.get("done"):
            count = state.get("count")
            del _pending_count_requests[url]
            return {"count": count, "url": url}

    # Timeout — devolver None sin error para que el frontend lo maneje
    _pending_count_requests.pop(url, None)
    return {"count": None, "url": url}

@app.get("/api/count-leads/pending")
def get_pending_count():
    """La extensión Chrome llama aquí para saber si hay una URL pendiente de contar."""
    if not _pending_count_requests:
        return {"pending": False, "url": None}
    url = next(iter(_pending_count_requests))
    return {"pending": True, "url": url}

@app.post("/api/count-leads/result")
def set_count_result(data: dict):
    """La extensión Chrome reporta el resultado del conteo."""
    url   = data.get("url", "")
    count = data.get("count")
    if url in _pending_count_requests:
        _pending_count_requests[url] = {"count": count, "done": True}
    return {"ok": True}

# ── Scrape URL (headless) ─────────────────────────────────────────────────────

@app.post("/api/scrape-url")
async def scrape_url(data: ScrapeRequest):
    from bs4 import BeautifulSoup
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            ctx = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                ),
                locale="es-PE",
            )
            page = await ctx.new_page()
            await page.goto(data.url, wait_until="domcontentloaded", timeout=15000)
            html  = await page.content()
            title = await page.title()
            await browser.close()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error Playwright: {exc}") from exc

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    visible = soup.get_text(separator=" ", strip=True)[:600]
    return {"title": title or "Sin título", "excerpt": visible, "url": data.url}

# ── Scrape LinkedIn profile (autenticado) ─────────────────────────────────────

@app.post("/api/scrape-profile")
async def scrape_profile(data: AuthScrapeRequest):
    # Usar cookie del request o fallback al li_at guardado por la extensión
    cookie_value = data.session_cookie.strip()
    if not cookie_value:
        cookie_value = _engine_cache.get("linkedinAccount", {}).get("cookie", "") or ""

    # Si no hay URL válida, extraer nombre desde la URL como fallback rápido
    if not cookie_value:
        parsed_quick = urlparse(data.url)
        path_parts = [p for p in parsed_quick.path.split("/") if p and p not in ("in", "sales", "people", "lead")]
        slug = path_parts[0] if path_parts else ""
        if slug:
            name_from_url = slug.replace("-", " ").title()
            # Limpiar sufijos numéricos tipo "-4592ba251"
            import re as _re
            name_from_url = _re.sub(r'\s+[A-Fa-f0-9]{6,}$', '', name_from_url).strip()
            return {
                "name":     name_from_url,
                "headline": "",
                "company":  "",
                "url":      data.url,
                "source":   "url_parse",
            }
        raise HTTPException(status_code=400, detail="No hay cookie li_at disponible. Conecta LinkedIn desde la extensión.")

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
            ctx = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                ),
                locale="es-PE",
            )

            parsed = urlparse(data.url)
            domain = parsed.hostname or "linkedin.com"
            cookie_name = "li_at" if "linkedin.com" in domain else "session_id"
            if "linkedin.com" in domain:
                domain = ".linkedin.com"

            await ctx.add_cookies([{
                "name": cookie_name, "value": cookie_value,
                "domain": domain, "path": "/",
            }])

            page = await ctx.new_page()
            await Stealth().apply_stealth_async(page)
            await page.goto(data.url, wait_until="domcontentloaded", timeout=30000)

            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass

            await page.wait_for_timeout(random.randint(2000, 4000))

            # Extraer campos
            async def get_text(selectors):
                for sel in selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            t = (await el.inner_text()).strip()
                            if t:
                                return t
                    except Exception:
                        pass
                return ""

            name = await get_text([".text-heading-xlarge", "h1"])
            if not name:
                title = await page.title()
                if " | LinkedIn" in title:
                    name = title.replace(" | LinkedIn", "").strip()

            headline = await get_text([
                ".pv-text-details__left-panel .text-body-medium.break-words",
                "div.text-body-medium.break-words",
            ])
            company = await get_text([
                ".pv-text-details__right-panel .inline-show-more-text",
                ".pv-text-details__right-panel span",
            ])
            location = await get_text([
                ".pv-text-details__left-panel .text-body-small.inline.t-black--light",
            ])
            about = await get_text([
                ".pv-shared-text-with-see-more span[aria-hidden='true']",
                "#about ~ div div div span[aria-hidden='true']",
            ])

            await browser.close()

            profile = {
                "name":     name     or "No encontrado",
                "headline": headline or "",
                "company":  company  or "",
                "location": location or "",
                "about":    about    or "",
                "url":      data.url,
            }

            # Guardar lead en Supabase si hay datos
            supabase = _get_supabase_admin()
            if supabase and name and name != "No encontrado":
                try:
                    supabase.table("leads").insert({
                        "full_name":    name,
                        "headline":     headline or None,
                        "company":      company  or None,
                        "linkedin_url": data.url,
                        "status":       "nuevo",
                        "value":        0,
                    }).execute()
                except Exception as exc:
                    logger.warning("Supabase lead insert falló: %s", exc)

            return profile

    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error scraping: {exc}") from exc

# ── Agent test chat ──────────────────────────────────────────────────────────

class AgentChatRequest(BaseModel):
    agent_config: dict = Field(..., description="Configuración del agente (tone, objective, value_prop, objections)")
    prospect_message: str = Field(..., description="Mensaje del prospecto de prueba")
    conversation_history: List[dict] = Field(default=[], description="Historial previo")

@app.get("/api/agents")
def get_agents(workspace_id: Optional[str] = None):
    """Lista agentes IA del workspace."""
    supabase = _get_supabase_admin()
    if not supabase:
        return {"agents": [], "count": 0}
    try:
        q = supabase.table("agents").select("*").order("created_at", desc=True)
        if workspace_id:
            q = q.eq("workspace_id", workspace_id)
        result = q.execute()
        return {"agents": result.data or [], "count": len(result.data or [])}
    except Exception as exc:
        logger.warning("get_agents falló: %s", exc)
        return {"agents": [], "count": 0}

@app.get("/api/team")
def get_team(workspace_id: Optional[str] = None):
    """Lista miembros del equipo (profiles del workspace)."""
    supabase = _get_supabase_admin()
    if not supabase:
        return {"members": [], "count": 0}
    try:
        q = supabase.table("profiles").select("id, full_name, email, role, job_title, created_at")
        if workspace_id:
            q = q.eq("workspace_id", workspace_id)
        result = q.execute()
        return {"members": result.data or [], "count": len(result.data or [])}
    except Exception as exc:
        logger.warning("get_team falló: %s", exc)
        return {"members": [], "count": 0}

@app.post("/api/agents/test-chat")
def agent_test_chat(data: AgentChatRequest):
    """Simula respuesta del agente IA para el wizard de prueba."""
    client = get_anthropic_client()

    cfg = data.agent_config
    tone = cfg.get("tone", "consultivo")
    objective = cfg.get("objective", "agendar_reunion")
    value_prop = cfg.get("value_proposition", "")
    objections = cfg.get("objections", [])

    obj_text = "\n".join(
        f"- Si dicen '{o.get('question', '')}' → responde: '{o.get('answer', '')}'"
        for o in (objections or [])[:5]
    )

    tone_guide = {
        "formal":     "formal y profesional",
        "consultivo": "consultivo y empático",
        "amigable":   "amigable y cercano",
        "directo":    "directo y conciso",
    }
    obj_guide = {
        "agendar_reunion": "agendar una reunión o demo de 20 minutos",
        "enviar_propuesta": "enviar una propuesta comercial",
        "calificar_lead": "calificar si tiene necesidad y presupuesto",
        "nutrir_lead": "mantener el interés hasta que esté listo",
    }

    system = f"""Eres un agente de ventas B2B con tono {tone_guide.get(tone, 'consultivo')}.
Tu objetivo es {obj_guide.get(objective, 'agendar una reunión')}.
Propuesta de valor: {value_prop or 'NexusAI automatiza la prospección en LinkedIn con IA.'}

Manejo de objeciones:
{obj_text or '- Sé empático y ofrece más información.'}

Reglas:
- Máximo 2 oraciones de respuesta.
- No rompas el personaje. Responde directamente como el agente.
- Si el prospecto muestra interés, avanza hacia el objetivo."""

    history = [
        {"role": "user" if m.get("role") == "prospect" else "assistant", "content": m.get("text", "")}
        for m in data.conversation_history[-6:]
        if m.get("text")
    ]
    history.append({"role": "user", "content": data.prospect_message})

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=200,
            system=system,
            messages=history,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error Anthropic API: {exc}") from exc

    reply = "".join(b.text for b in response.content if hasattr(b, "text")).strip()
    return {"reply": reply}

# ── Ghost Engine status (leído desde chrome.storage via extensión) ────────────
# El dashboard hace polling aquí cada 4s. La extensión escribe su estado
# en Supabase (tabla activity_log) o lo expone via este proxy endpoint.
# Por ahora devuelve el último estado cacheado en memoria del proceso FastAPI.

_engine_cache: dict = {
    "engine": {"running": False, "processing": False, "nextTaskAt": None, "currentTask": None},
    "taskQueue": [],
    "byType": {"send_connection": 0, "send_message": 0, "visit_profile": 0, "like_post": 0},
    "dailyStats": {"send_connection": 0, "send_message": 0, "visit_profile": 0, "like_post": 0},
    "linkedinAccount": {"connected": False, "profileName": None},
}

class EnqueueTaskRequest(BaseModel):
    task_type: str = Field(..., description="send_message | send_connection | like_post | visit_profile")
    lead_data: dict = Field(default={}, description="{ name, profileUrl, company, headline }")
    payload:   dict = Field(default={}, description="{ messageText, note, etc. }")
    campaign_id: Optional[str] = None

@app.post("/api/engine/enqueue")
def engine_enqueue(data: EnqueueTaskRequest):
    """Agrega una tarea a la cola del Ghost Engine (extensión la ejecutará en su próximo tick)."""
    task = {
        "id":          f"task_{int(__import__('time').time()*1000)}",
        "type":        data.task_type,
        "leadData":    data.lead_data,
        "payload":     data.payload,
        "campaignId":  data.campaign_id,
        "attempts":    0,
        "status":      "pending",
        "createdAt":   int(__import__('time').time() * 1000),
    }
    _engine_cache.setdefault("taskQueue", []).append(task)
    return {"ok": True, "task_id": task["id"], "queue_length": len(_engine_cache["taskQueue"])}

@app.post("/api/messages/sync")
def sync_messages(data: dict):
    """La extensión envía los mensajes del inbox de LinkedIn para sincronizarlos."""
    supabase = _get_supabase_admin()
    messages = data.get("messages", [])
    lead_id  = data.get("lead_id")
    if not supabase or not lead_id or not messages:
        return {"ok": True, "synced": 0}
    synced = 0
    for msg in messages:
        try:
            supabase.table("messages").upsert({
                "lead_id":      lead_id,
                "sender":       "prospect" if msg.get("sender") == "lead" else msg.get("sender", "user"),
                "message_text": msg.get("text", ""),
                "is_read":      msg.get("read", False),
                "timestamp":    msg.get("time", __import__('datetime').datetime.utcnow().isoformat()),
            }, on_conflict="lead_id,timestamp").execute()
            synced += 1
        except Exception as exc:
            logger.warning("sync_messages falló para mensaje: %s", exc)
    return {"ok": True, "synced": synced}

@app.get("/api/engine/status")
def engine_status():
    return _engine_cache

@app.post("/api/engine/start")
def engine_start():
    _engine_cache["engine"]["running"] = True
    return {"ok": True, "running": True}

@app.post("/api/engine/stop")
def engine_stop():
    _engine_cache["engine"]["running"]    = False
    _engine_cache["engine"]["processing"] = False
    return {"ok": True, "running": False}

@app.post("/api/engine/sync")
def engine_sync(data: dict):
    """La extensión Chrome hace POST aquí cada vez que cambia su estado interno."""
    _engine_cache.update(data)
    return {"ok": True}
