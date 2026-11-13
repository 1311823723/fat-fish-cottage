import { defineConfig } from "vite";
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const bootstrap=fs.readFileSync('src/client/room-bootstrap.js','utf8');
const bootstrapFile='assets/room-bootstrap-'+createHash('sha256').update(bootstrap).digest('hex').slice(0,12)+'.js';
export default defineConfig({
  plugins:[{name:'room-first-paint',buildStart(){this.emitFile({type:'asset',fileName:bootstrapFile,source:bootstrap});},transformIndexHtml(html,context){
    const runtime=JSON.parse(fs.readFileSync('public/assets/room-runtime.json','utf8'));
    return {html:html.replace('/assets/room-v5.webp',runtime.images.room),tags:[{tag:'script',attrs:{src:context.server?'/src/client/room-bootstrap.js':'/'+bootstrapFile,defer:true},injectTo:'head-prepend'},{tag:'link',attrs:{rel:'preload',as:'image',href:runtime.images.room,fetchpriority:'high'},injectTo:'head'}]};
  }}],
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:3103",
      "/room-photo": "http://127.0.0.1:3103",
    },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: (id: string) =>
          id.includes("/phaser/") ? "phaser" : undefined,
      },
    },
  },
});
