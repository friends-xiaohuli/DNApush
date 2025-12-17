import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import Page1 from '../views/page1.vue'
import Page2 from '../views/page2.vue'


const routes = [
  { path: '/', component: Home },
  { path: '/page1', component: Page1 },
  { path: '/page2', component: Page2 },
//   { path: '/page3', component: Page3 },
//   { path: '/page4', component: Page4 }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
