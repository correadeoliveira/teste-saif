import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, AlertTriangle, Check, X } from "lucide-react";

const G = {
  bright:  "#00ff41",
  mid:     "#00cc33",
  dim:     "#007a20",
  faint:   "#003310",
  bg:      "#000900",
  panel:   "#010d02",
  border:  "rgba(0,255,65,0.14)",
  glow:    "rgba(0,255,65,0.6)",
  danger:  "#ff2200",
  warn:    "#ffaa00",
  blue:    "#0099ff",
  scanline:"rgba(0,0,0,0.08)",
};

const crtGlow = (color = G.bright, strength = 8) =>
  `0 0 ${strength}px ${color}, 0 0 ${strength * 2}px ${color}40`;

// Types for our questions
type Question = {
  id: string;
  title: string;
  options: string[];
};

// Placeholder questions
const QUESTIONS: Question[] = [
  { id: "1", title: "Pergunta 1: Placeholder?", options: ["Opção A", "Opção B", "Opção C"] },
  { id: "2", title: "Pergunta 2: Placeholder?", options: ["Sim", "Não"] },
  { id: "3", title: "Pergunta 3: Placeholder?", options: ["Muito", "Pouco", "Nada"] },
  { id: "4", title: "Pergunta 4: Você frequenta áreas de risco?", options: ["Sempre", "Às vezes", "Raramente", "Nunca"] },
];

const SUB_QUESTIONS: Question[] = [
  { id: "4.1", title: "Pergunta 4.1: Qual área?", options: ["Centro", "Zona Sul", "Zona Norte", "Outra"] },
  { id: "4.2", title: "Pergunta 4.2: Em que horário?", options: ["Manhã", "Tarde", "Noite", "Madrugada"] },
  { id: "4.3", title: "Pergunta 4.3: Qual meio de transporte?", options: ["A pé", "Carro", "Transporte Público"] },
  { id: "4.4", title: "Pergunta 4.4: Se sente seguro?", options: ["Sim", "Não"] },
];

export default function Questionnaire({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSkipping, setIsSkipping] = useState(false);

  // Determine the sequence of questions based on answers
  const showSubQuestions = answers["4"] && answers["4"].toLowerCase() !== "nunca";
  const currentQuestions = showSubQuestions ? [...QUESTIONS, ...SUB_QUESTIONS] : QUESTIONS;
  
  const currentQ = currentQuestions[step];
  const isLastStep = step === currentQuestions.length - 1;
  const currentAnswer = answers[currentQ?.id];

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkipClick = () => {
    setIsSkipping(true);
  };

  const confirmSkip = () => {
    onComplete();
  };

  const cancelSkip = () => {
    setIsSkipping(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-50 flex items-center justify-center p-6"
        style={{
          background: "rgba(0, 9, 0, 0.90)",
          backdropFilter: "blur(10px)",
          fontFamily: "'Share Tech Mono', 'JetBrains Mono', monospace",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Scanlines overlay for the modal background */}
        <div 
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,rgba(0,0,0,0.15) 0px,rgba(0,0,0,0.15) 1px,transparent 1px,transparent 3px)" }}
        />

        {!isSkipping ? (
          <motion.div
            key="questionnaire-box"
            className="w-full max-w-md border flex flex-col relative z-10"
            style={{
              borderColor: G.bright,
              background: "#010d02",
              boxShadow: `0 0 20px ${G.glow}`,
            }}
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: -20, opacity: 0 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: G.border, background: "rgba(0,255,65,0.05)" }}>
              <div className="flex items-center gap-2">
                <Shield size={16} style={{ color: G.bright }} />
                <span className="text-sm tracking-widest font-bold" style={{ color: G.bright, textShadow: crtGlow() }}>
                  CALIBRAÇÃO DE SEGURANÇA
                </span>
              </div>
              <span className="text-xs" style={{ color: G.dim }}>
                {step + 1} / {currentQuestions.length}
              </span>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col gap-6">
              <h2 className="text-xl font-bold uppercase tracking-wide leading-relaxed" style={{ color: G.bright, textShadow: crtGlow(G.bright, 4) }}>
                {currentQ?.title}
              </h2>

              <div className="flex flex-col gap-3">
                {currentQ?.options.map((opt) => {
                  const isSelected = currentAnswer === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswers({ ...answers, [currentQ.id]: opt })}
                      className="px-4 py-3 text-left border uppercase tracking-wider transition-all duration-200 flex justify-between items-center"
                      style={{
                        background: isSelected ? `${G.bright}20` : "transparent",
                        borderColor: isSelected ? G.bright : G.dim,
                        color: isSelected ? G.bright : G.dim,
                        boxShadow: isSelected ? `0 0 10px ${G.glow}` : "none"
                      }}
                    >
                      <span>{opt}</span>
                      {isSelected && <Check size={16} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: G.border, background: "rgba(0,0,0,0.3)" }}>
              <button 
                onClick={handleSkipClick}
                className="text-xs uppercase tracking-widest px-3 py-2 transition-colors hover:opacity-70"
                style={{ color: G.dim }}
              >
                Pular
              </button>

              <button
                onClick={handleNext}
                disabled={!currentAnswer}
                className="px-6 py-2 text-sm uppercase tracking-widest font-bold transition-all duration-300 disabled:opacity-50"
                style={{
                  background: currentAnswer ? G.bright : G.dim,
                  color: currentAnswer ? G.bg : "#011a05",
                  boxShadow: currentAnswer ? crtGlow(G.bright, 5) : "none"
                }}
              >
                {isLastStep ? "Concluir Questionário" : "Próximo"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="skip-warning"
            className="w-full max-w-sm border relative z-10"
            style={{
              borderColor: G.danger,
              background: "#1a0200",
              boxShadow: `0 0 30px rgba(255,34,0,0.4)`,
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="p-5 flex flex-col items-center text-center gap-4 border-b" style={{ borderColor: "rgba(255,34,0,0.2)" }}>
              <div className="w-12 h-12 flex items-center justify-center rounded-full" style={{ background: "rgba(255,34,0,0.15)" }}>
                <AlertTriangle size={24} style={{ color: G.danger }} />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2 uppercase tracking-wide" style={{ color: G.danger, textShadow: crtGlow(G.danger, 6) }}>
                  Atenção
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,100,100,0.85)" }}>
                  Estas perguntas são extremamente importantes para a <strong>sua segurança</strong> e para um monitoramento mais preciso do sistema.
                </p>
                <p className="text-sm mt-3" style={{ color: "rgba(255,100,100,0.7)" }}>
                  Tem certeza que deseja pular?
                </p>
              </div>
            </div>
            
            <div className="flex">
              <button 
                onClick={cancelSkip}
                className="flex-1 py-3 text-sm font-bold uppercase tracking-widest border-r transition-colors"
                style={{ borderColor: "rgba(255,34,0,0.2)", color: G.bright, background: "rgba(0,255,65,0.05)" }}
              >
                Voltar
              </button>
              <button 
                onClick={confirmSkip}
                className="flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors"
                style={{ color: G.danger, background: "rgba(255,34,0,0.1)" }}
              >
                Sim, Pular
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
