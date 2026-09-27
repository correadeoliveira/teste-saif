const Module = require("module");
const path = require("path");

const shims = {
    "react-native": path.join(__dirname, "shims/react-native.cjs"),
    "@react-native-async-storage/async-storage": path.join(__dirname, "shims/async-storage.cjs"),
    "expo-constants": path.join(__dirname, "shims/expo-constants.cjs"),
    "expo-file-system/legacy": path.join(__dirname, "shims/expo-file-system.cjs"),
    "expo-sharing": path.join(__dirname, "shims/expo-sharing.cjs"),
    "react-native-url-polyfill/auto": path.join(__dirname, "shims/url-polyfill.cjs"),
    "@supabase/supabase-js": path.join(__dirname, "shims/supabase-js.cjs"),
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(shims, request)) {
        return originalLoad.call(this, shims[request], parent, isMain);
    }
    return originalLoad.call(this, request, parent, isMain);
};
