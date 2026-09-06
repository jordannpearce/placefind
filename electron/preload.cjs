const { contextBridge } = require("electron")

contextBridge.exposeInMainWorld("placefindDesktop", {
  isDesktop: true,
})
