/**
 * Re-exporta o estado compartilhado dos mocks CJS para os testes TypeScript.
 */
export {
    resetMemory,
    resetSupabaseMock,
    setRpcHandler,
    setUpsertHandler,
} from "./state.cjs";
