// Demo: többféle saját funkció definiálás

// A) namespace objektum inline onclick-hez
window.aqDemo = {
  async goto(pageKey) {
    await aq.navigate(pageKey);
  },

  ping() {
    console.log("[page1] ping", new Date().toISOString());
  },

  async makeHelperAndUse() {
    // B) lokális helper függvény (nem globális)
    const helper = async () => {
      const info = await aq.protocolInfo();
      return `[helper] ${info.pageKey} ${info.time}`;
    };
    console.log(await helper());
  },

  async namespaceCall() {
    // C) külön namespace (globál) + hivatkozás
    console.log(await window.aqTools.status());
  }
};

// C) külön globál namespace
window.aqTools = {
  async status() {
    const info = await aq.protocolInfo();
    return { tag: "aqTools.status", info };
  }
};
