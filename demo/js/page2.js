window.aqDemo = {
  async goto(pageKey) {
    await aq.navigate(pageKey);
  },

  async renderInfo() {
    const info = await aq.protocolInfo();
    const out = document.getElementById("aqOut");
    if (out) out.textContent = JSON.stringify(info, null, 2);
  },

  throwTest() {
    try {
      throw new Error("[page2] demo error");
    } catch (e) {
      console.warn("caught:", e.message);
      console.log(e.message);
//      alert(e.message);
    }
  },

  async asyncChain() {
    const a = await aq.protocolInfo();
    console.log("[page2] step1", a.time);
    const b = await aq.protocolInfo();
    console.log("[page2] step2", b.time);
  }
};
