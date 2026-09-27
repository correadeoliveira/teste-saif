const store = new Map();

function getItem(key) {
    return Promise.resolve(store.has(key) ? store.get(key) : null);
}
function setItem(key, value) {
    store.set(key, value);
    return Promise.resolve();
}
function removeItem(key) {
    store.delete(key);
    return Promise.resolve();
}
function clear() {
    store.clear();
    return Promise.resolve();
}
function resetMemory() {
    store.clear();
}

const asyncStorage = { getItem, setItem, removeItem, clear, resetMemory };

let rpcHandler = async () => ({ data: null, error: { message: "rpc not mocked" } });
let upsertHandler = async () => ({ error: null });

function setRpcHandler(handler) {
    rpcHandler = handler;
}
function setUpsertHandler(handler) {
    upsertHandler = handler;
}
function resetSupabaseMock() {
    rpcHandler = async () => ({ data: null, error: { message: "rpc not mocked" } });
    upsertHandler = async () => ({ error: null });
}

module.exports = {
    store,
    asyncStorage,
    resetMemory,
    setRpcHandler,
    setUpsertHandler,
    resetSupabaseMock,
    rpc: (fn, args) => rpcHandler(fn, args),
    upsert: (row) => upsertHandler(row),
};
