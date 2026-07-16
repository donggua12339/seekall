const start = Date.now()
fetch("https://so.252035.xyz/api/search", {
  method: "POST",
  headers: {"Content-Type": "application/json", "User-Agent": "curl/8.19.0"},
  body: JSON.stringify({kw: "test", res: "merge"})
}).then(r => r.json()).then(d => {
  console.log("Node fetch total:", d.data?.total, "time:", Date.now()-start, "ms")
}).catch(e => console.log("error:", e.message))
