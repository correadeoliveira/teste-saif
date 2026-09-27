import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, AlertTriangle, Check, X, ChevronDown } from "lucide-react";

const G = {
  bright:  "#ffcb00",
  mid:     "#d9a600",
  dim:     "#8a6d00",
  faint:   "#3d3000",
  bg:      "#0a0800",
  panel:   "#0f0c00",
  border:  "rgba(255,203,0,0.14)",
  glow:    "rgba(255,203,0,0.6)",
  danger:  "#ff2200",
  warn:    "#ff7a1a",
  blue:    "#0099ff",
  scanline:"rgba(0,0,0,0.08)",
};

const crtGlow = (color = G.bright, strength = 8) =>
  `0 0 ${strength}px ${color}, 0 0 ${strength * 2}px ${color}40`;

const STORAGE_KEY = "saifen.behavior_profile.v1";

type Mode = "single" | "multi";

type Question = {
  id: string;
  label: string;
  options: string[];
  mode: Mode;
};

type Section = {
  id: string;
  title: string;
  hint: string;
  questions: Question[];
  // só aparece se a resposta da pergunta `dependsOn` não for "não"
  dependsOn?: string;
  skipWhen?: string;
};

// Uma tela, quatro seções. As 4 sub-perguntas de compartilhamento só
// aparecem quando o usuário admite que cede o aparelho a terceiros —
// antes elas quebravam o fluxo no meio, empurrando 4 telas extras.
const SECTIONS: Section[] = [
  {
    id: "rotina",
    title: "Rotina",
    hint: "Onde e quando você usa o aparelho.",
    questions: [
      {
        id: "mobilidade",
        label: "Como você usa o celular na maior parte do dia?",
        mode: "single",
        options: [
          "Transporte público",
          "Carro (suporte / Bluetooth)",
          "Caminhando pela rua",
          "Parado (escritório / casa)",
        ],
      },
      {
        id: "picos",
        label: "Quando é o pico de uso?",
        mode: "single",
        options: ["Manhã e noite", "Horário comercial", "Madrugada", "Sem padrão fixo"],
      },
      {
        id: "locais",
        label: "Locais onde o celular deve ter menos restrição",
        mode: "multi",
        options: ["Casa", "Trabalho", "Casa de familiares", "Academia", "Outros"],
      },
      {
        id: "aglomeracao",
        label: "Com que frequência você vai a locais muito movimentados ou de alto risco de furto?",
        mode: "single",
        options: ["Diariamente", "Fins de semana", "Raramente", "Nunca"],
      },
    ],
  },
  {
    id: "compartilhamento",
    title: "Compartilhamento",
    hint: "Quem mais encosta no seu aparelho.",
    questions: [
      {
        id: "terceiros",
        label: "Quem tem acesso ao seu celular desbloqueado?",
        mode: "multi",
        options: ["Filhos / crianças", "Cônjuge / parceiro(a)", "Amigos / colegas", "Ninguém além de mim"],
      },
    ],
  },
  {
    id: "compartilhamento-detalhe",
    title: "Compartilhamento · detalhe",
    hint: "Só aparece se o celular sai da sua mão.",
    dependsOn: "terceiros",
    skipWhen: "Ninguém além de mim",
    questions: [
      {
        id: "uso_terceiros",
        label: "Para que costumam usar quando está com terceiros?",
        mode: "multi",
        options: ["Vídeos / jogos", "Chamadas / fotos", "Navegação sob minha supervisão"],
      },
      {
        id: "frequencia_emprestimo",
        label: "Com que frequência empresta ou deixa o aparelho com outra pessoa?",
        mode: "single",
        options: ["Diariamente", "1 a 2 vezes por semana", "Raras vezes no mês", "Nunca"],
      },
      {
        id: "modo_visitante",
        label: "Prefere ativar um 'Modo Visitante' manualmente?",
        mode: "single",
        options: ["Sim, botão rápido", "Não, detectar automaticamente"],
      },
      {
        id: "acao_imediata",
        label: "O que fazer quando o sistema detectar outra pessoa usando?",
        mode: "single",
        options: [
          "Bloquear a tela",
          "Bloquear só apps sensíveis (banco, mensagens, fotos)",
          "Pedir PIN / biometria na próxima ação",
        ],
      },
    ],
  },
  {
    id: "protecao",
    title: "Proteção",
    hint: "O que travar e como destravar.",
    questions: [
      {
        id: "apps_criticos",
        label: "Bloquear primeiro ao menor sinal de anomalia",
        mode: "multi",
        options: [
          "Bancos e carteiras digitais",
          "WhatsApp / e-mail / redes",
          "Galeria de fotos",
          "Configurações do sistema",
        ],
      },
      {
        id: "reauth",
        label: "Em desvio leve, como reautenticar?",
        mode: "single",
        options: ["Biometria discreta", "PIN de 4 dígitos", "Bloqueio total sem aviso"],
      },
      {
        id: "tempo_limite",
        label: "Quanto tempo parado antes de exigir validação reforçada?",
        mode: "single",
        options: ["Imediato", "1 a 5 minutos", "Mais de 15 minutos"],
      },
      {
        id: "ancoras",
        label: "O que conta como 'âncora de confiança' para não bloquear?",
        mode: "multi",
        options: ["Smartwatch no pulso", "Fone Bluetooth conectado", "Som do carro", "Nada"],
      },
    ],
  },
  {
    id: "contexto",
    title: "Contexto",
    hint: "Fora da sua rotina.",
    questions: [
      {
        id: "fora_rotina",
        label: "Fora das suas zonas de rotina, o sistema deve:",
        mode: "single",
        options: ["Aumentar a rigidez", "Manter o padrão", "Avisar antes de bloquear"],
      },
      {
        id: "gps",
        label: "Com o GPS ativo no suporte, deve suspender o bloqueio?",
        mode: "single",
        options: ["Sim, manter desbloqueado", "Não, continuar monitorando"],
      },
    ],
  },
];

// ── persistence ─────────────────────────────────────────────────────────────

function loadSaved(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function Questionnaire({ onComplete }: { onComplete: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(loadSaved);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSkipping, setIsSkipping] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Persiste a cada mudança para nada se perder num refresh.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); } catch { /* quota */ }
  }, [answers]);

  // Uma seção condicional só entra depois de a pergunta-pai ser respondida
  // E de a resposta não ser a que dispensa o detalhe. Três casos, na ordem:
  //   1. sem resposta ainda -> oculta
  //   2. resposta == skipWhen -> oculta
  //   3. caso contrário -> visível
  const visibleSections = useMemo(
    () =>
      SECTIONS.filter((s) => {
        if (!s.dependsOn) return true;
        const parent = answers[s.dependsOn] ?? [];
        if (parent.length === 0) return false;
        if (s.skipWhen && parent.includes(s.skipWhen)) return false;
        return true;
      }),
    [answers]
  );

  const allQuestions = useMemo(() => visibleSections.flatMap((s) => s.questions), [visibleSections]);
  const answered = allQuestions.filter((q) => (answers[q.id] ?? []).length > 0).length;
  const total = allQuestions.length;
  const complete = total > 0 && answered === total;

  const toggle = (q: Question, opt: string) => {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.mode === "single") return { ...prev, [q.id]: [opt] };
      return { ...prev, [q.id]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] };
    });
    setStatus("idle");
  };

  const submit = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/behavior-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, version: 1, completed_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("saved");
    } catch {
      // Sem backend, a resposta continua salva no localStorage.
      setStatus("error");
    }
    onComplete();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: "rgba(10, 8, 0, 0.92)",
          backdropFilter: "blur(10px)",
          fontFamily: "'Share Tech Mono', 'JetBrains Mono', monospace",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,rgba(0,0,0,0.15) 0deg,rgba(0,0,0,0.15) 1px,transparent 1px,transparent 3px)" }}
        />

        {!isSkipping ? (
          <motion.div
            key="panel"
            className="w-full max-w-md border flex flex-col relative z-10 max-h-full"
            style={{
              borderColor: G.bright,
              background: G.panel,
              boxShadow: `0 0 20px ${G.glow}`,
            }}
            initial={{ scale: 0.97, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: -16, opacity: 0 }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b shrink-0"
              style={{ borderColor: G.border, background: "rgba(255,203,0,0.05)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Shield size={15} style={{ color: G.bright, flexShrink: 0 }} />
                <span
                  className="text-xs tracking-widest font-bold truncate"
                  style={{ color: G.bright, textShadow: crtGlow() }}
                >
                  CALIBRAÇÃO DE SEGURANÇA
                </span>
              </div>
              <span className="text-xs shrink-0 ml-2" style={{ color: G.dim }}>
                {answered}/{total}
              </span>
            </div>

            {/* progresso */}
            <div className="h-0.5 shrink-0" style={{ background: G.faint }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${total ? (answered / total) * 100 : 0}%`,
                  background: G.bright,
                  boxShadow: complete ? crtGlow(G.bright, 5) : "none",
                }}
              />
            </div>

            <div className="overflow-y-auto flex-1" style={{ background: G.bg }}>
              {visibleSections.map((section) => {
                const open = !collapsed[section.id];
                const secAnswered = section.questions.filter(
                  (q) => (answers[q.id] ?? []).length > 0
                ).length;
                const isDetail = Boolean(section.dependsOn);

                return (
                  <section key={section.id} className="border-b" style={{ borderColor: G.border }}>
                    <button
                      onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))}
                      className="w-full px-4 py-3 flex items-center justify-between gap-2 transition-colors hover:bg-white/5"
                      style={{ background: isDetail ? "rgba(255,203,0,0.03)" : "transparent" }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-xs tracking-widest font-bold truncate"
                          style={{ color: secAnswered === section.questions.length ? G.bright : G.mid }}
                        >
                          {section.title}
                        </span>
                        <span className="text-[10px] truncate" style={{ color: G.dim }}>
                          {section.hint}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-[10px]"
                          style={{ color: secAnswered === section.questions.length ? G.bright : G.dim }}
                        >
                          {secAnswered}/{section.questions.length}
                        </span>
                        <ChevronDown
                          size={13}
                          style={{
                            color: G.dim,
                            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform .2s",
                          }}
                        />
                      </span>
                    </button>

                    {open && (
                      <div className="px-4 pb-4 flex flex-col gap-4">
                        {section.questions.map((q) => {
                          const cur = answers[q.id] ?? [];
                          return (
                            <div key={q.id}>
                              <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-xs leading-snug" style={{ color: G.bright }}>
                                  {q.label}
                                </span>
                                <span className="text-[9px] shrink-0" style={{ color: G.dim }}>
                                  {q.mode === "multi" ? "MULTI" : "1"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {q.options.map((opt) => {
                                  const on = cur.includes(opt);
                                  return (
                                    <button
                                      key={opt}
                                      onClick={() => toggle(q, opt)}
                                      className="px-2 py-1 text-[10px] uppercase tracking-wider border transition-all duration-150 flex items-center gap-1"
                                      style={{
                                        fontFamily: "'JetBrains Mono', monospace",
                                        background: on ? "rgba(255,203,0,0.14)" : "transparent",
                                        borderColor: on ? G.bright : G.faint,
                                        color: on ? G.bright : G.dim,
                                        boxShadow: on ? `0 0 6px ${G.glow}` : "none",
                                      }}
                                    >
                                      {on && <Check size={9} />}
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <div
              className="px-4 py-3 border-t flex items-center justify-between gap-3 shrink-0"
              style={{ borderColor: G.border, background: "rgba(0,0,0,0.3)" }}
            >
              <button
                onClick={() => setIsSkipping(true)}
                className="text-xs uppercase tracking-widest px-2 py-2 transition-colors hover:opacity-70 shrink-0"
                style={{ color: G.dim }}
              >
                Pular
              </button>

              <div className="flex items-center gap-2 min-w-0">
                {status === "saving" && (
                  <span className="text-[10px] shrink-0" style={{ color: G.dim }}>ENVIANDO…</span>
                )}
                {status === "error" && (
                  <span className="text-[10px] shrink-0" style={{ color: G.warn }}>SALVO LOCAL</span>
                )}
                <button
                  onClick={submit}
                  disabled={!complete}
                  className="px-4 py-2 text-xs uppercase tracking-widest font-bold transition-all duration-300 disabled:opacity-40 shrink-0"
                  style={{
                    background: complete ? G.bright : G.faint,
                    color: complete ? G.bg : G.dim,
                    boxShadow: complete ? crtGlow(G.bright, 5) : "none",
                  }}
                >
                  Concluir
                </button>
              </div>
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
            <div
              className="p-5 flex flex-col items-center text-center gap-4 border-b"
              style={{ borderColor: "rgba(255,34,0,0.2)" }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center rounded-full"
                style={{ background: "rgba(255,34,0,0.15)" }}
              >
                <AlertTriangle size={24} style={{ color: G.danger }} />
              </div>
              <div>
                <h3
                  className="text-lg font-bold mb-2 uppercase tracking-wide"
                  style={{ color: G.danger, textShadow: crtGlow(G.danger, 6) }}
                >
                  Atenção
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,140,120,0.9)" }}>
                  Sem estas respostas o sistema não consegue ajustar o nível de rigidez às
                  zonas onde você mais usa o aparelho.
                </p>
                <p className="text-sm mt-3" style={{ color: "rgba(255,140,120,0.7)" }}>
                  Tem certeza que deseja pular?
                </p>
              </div>
            </div>

            <div className="flex">
              <button
                onClick={() => setIsSkipping(false)}
                className="flex-1 py-3 text-sm font-bold uppercase tracking-widest border-r transition-colors"
                style={{ borderColor: "rgba(255,34,0,0.2)", color: G.bright, background: "rgba(255,203,0,0.05)" }}
              >
                Voltar
              </button>
              <button
                onClick={submit}
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
