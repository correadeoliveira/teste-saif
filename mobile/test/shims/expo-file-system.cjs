module.exports = {
    documentDirectory: "file:///tmp/saifen-test/",
    EncodingType: { UTF8: "utf8" },
    getInfoAsync: async () => ({ exists: false }),
    makeDirectoryAsync: async () => {},
    writeAsStringAsync: async () => {},
    readAsStringAsync: async () => "",
    readDirectoryAsync: async () => [],
};
