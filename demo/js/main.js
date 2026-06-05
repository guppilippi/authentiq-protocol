// 1) Globális namespace az inline onclick-hez
window.aqDemo = {
  async goto(pageKey) {
    await aq.navigate(pageKey); // azonnal vált
  },


  async showProtocolInfo() {
    const info = await aq.protocolInfo();
//    alert(`protocolVersion? (nincs még a minimalban) time=${info.time}\npageKey=${info.pageKey}\ndevMode=${info.devMode}`);
    console.log(`protocolVersion? (nincs még a minimalban) time=${info.time}\npageKey=${info.pageKey}\ndevMode=${info.devMode}`);
  },

  async logProtocolInfo() {
    const info = await aq.protocolInfo();
    console.log("[main] protocolInfo", info);
  },

  // 2) Inline handlerhez globál definíció bemutatása
  defineInlineGlobal() {
    window.valami = async function valami() {
      const info = await aq.protocolInfo();
      console.log(`[valami] ${info.pageKey} @ ${info.time}`);
//      alert(`[valami] ${info.pageKey} @ ${info.time}`);
    };
    console.log("[main] window.valami defined. Try clicking 'call valami()'.");
  },
  
  async test() {
	  console.log('it1 1');
	  await test();
  }
};

// 3) Direkt globális function declaration (inline is látja)
// (kicsit “szennyezős”, de demo)
window.valami = window.valami || function valami() {
  console.log("valami() még nincs async-ra cserélve. Nyomd meg a define gombot.");
//  alert("valami() még nincs async-ra cserélve. Nyomd meg a define gombot.");
};

async function test() {
	console.log('async tesr');
}