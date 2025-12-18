import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import Page1 from '../views/page1.vue'
import Page2 from '../views/page2.vue'
import Page3 from '../views/page3.vue'
import about from '../views/about.vue'
import ExpCalculator from '../views/ExpCalculator.vue'
import instanceInfo from '../views/instanceInfo.vue'


const routes = [
  { path: '/', component: Home },
  { path: '/page1', component: Page1 },
  { path: '/page2', component: Page2 },
  { path: '/page3', component: Page3 },
  { path: '/ExpCalculator', component: ExpCalculator },
  { path: '/instanceInfo', component: instanceInfo },
  { path: '/about', component: about }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
