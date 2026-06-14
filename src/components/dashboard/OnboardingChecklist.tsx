"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Globe, Users, Megaphone } from "lucide-react";
import { completeOnboardingStep, markOnboardingComplete } from "@/app/dashboard/actions";
import type { OnboardingSteps } from "@/app/dashboard/actions";

// ---------------------------------------------------------------------------

type StepDef = {
  id: keyof OnboardingSteps;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onAction: () => void;
};

// ---------------------------------------------------------------------------

type Props = {
  initialSteps: OnboardingSteps;
};

export function OnboardingChecklist({ initialSteps }: Props) {
  const router = useRouter();
  const [steps, setSteps] = useState<OnboardingSteps>(initialSteps);
  const [dismissed, setDismissed] = useState(false);
  const confettiFired = useRef(false);

  const stepDefs: StepDef[] = [
    {
      id: "extension_installed",
      icon: <Globe size={16} />,
      title: "Instala la extensión de Chrome",
      description: "Necesaria para que el motor de automatización funcione",
      cta: "Instalar extensión",
      onAction: () =>
        window.open(
          "https://chrome.google.com/webstore/detail/cazary-ai/placeholder",
          "_blank"
        ),
    },
    {
      id: "linkedin_connected",
      icon: <Users size={16} />,
      title: "Conecta tu cuenta de LinkedIn",
      description: "Vincula tu perfil para comenzar a prospectar",
      cta: "Conectar LinkedIn",
      onAction: () => router.push("/dashboard/configuracion"),
    },
    {
      id: "first_campaign_created",
      icon: <Megaphone size={16} />,
      title: "Crea tu primera campaña",
      description: "Configura tu primera secuencia de automatización",
      cta: "Crear campaña",
      onAction: () => router.push("/dashboard/campanas"),
    },
  ];

  const completedCount = stepDefs.filter((s) => steps[s.id]).length;
  const allDone = completedCount === stepDefs.length;

  // Determine which step is the current active one (first incomplete)
  const activeIndex = stepDefs.findIndex((s) => !steps[s.id]);

  // Fire confetti + mark complete when all steps done
  useEffect(() => {
    if (!allDone || confettiFired.current) return;
    confettiFired.current = true;

    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.5 },
        colors: ["#2563eb", "#06b6d4", "#7c3aed", "#10b981"],
      });
    });

    markOnboardingComplete().then(() => {
      setTimeout(() => setDismissed(true), 2200);
    });
  }, [allDone]);

  async function handleStepAction(def: StepDef) {
    def.onAction();
    // Optimistically mark step complete in local state
    setSteps((prev) => ({ ...prev, [def.id]: true }));
    await completeOnboardingStep(def.id);
    router.refresh();
  }

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="onboarding-card"
          initial={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="rounded-2xl p-6 mb-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(6,182,212,0.05) 100%)",
            border: "1px solid rgba(37,99,235,0.25)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Configura tu cuenta
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedCount} de {stepDefs.length} pasos completados
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-32 h-2 rounded-full bg-border overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #2563eb, #06b6d4)",
                }}
                initial={{ width: 0 }}
                animate={{
                  width: `${(completedCount / stepDefs.length) * 100}%`,
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {stepDefs.map((def, i) => {
              const done = steps[def.id];
              const isCurrent = i === activeIndex;

              return (
                <div
                  key={def.id}
                  className="flex items-center gap-4"
                >
                  {/* Circle indicator */}
                  <div className="relative flex-shrink-0 w-8 h-8">
                    <motion.div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                      animate={
                        done
                          ? { backgroundColor: "#10b981", color: "#ffffff", scale: 1 }
                          : { backgroundColor: "transparent", color: "var(--muted-foreground)", scale: 1 }
                      }
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      style={
                        done
                          ? {}
                          : { border: "2px solid var(--border)" }
                      }
                    >
                      <AnimatePresence mode="wait">
                        {done ? (
                          <motion.span
                            key="check"
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.4, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          >
                            <Check size={14} strokeWidth={3} />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="num"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                          >
                            {i + 1}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium leading-tight ${
                        done ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {def.title}
                    </p>
                    {!done && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {def.description}
                      </p>
                    )}
                  </div>

                  {/* CTA — only shown on the active (first incomplete) step */}
                  <AnimatePresence>
                    {isCurrent && !done && (
                      <motion.button
                        key="cta"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => handleStepAction(def)}
                        className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                        style={{
                          background: "linear-gradient(90deg, #2563eb, #06b6d4)",
                        }}
                      >
                        {def.icon}
                        {def.cta}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
