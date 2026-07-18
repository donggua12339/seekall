import { createApp } from 'vue'
import { createPinia } from 'pinia'
import NaiveUI from 'naive-ui'
import App from './App.vue'
import router from './router'
import 'virtual:uno.css'
import 'vfonts/Lato.css'
import 'vfonts/FiraCode.css'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(NaiveUI)
app.mount('#app')
