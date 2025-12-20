import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import Page1 from '../views/page1.vue'
import Page2 from '../views/page2.vue'
import Page3 from '../views/page3.vue'
import about from '../views/about.vue'
import ExpCalculator from '../views/ExpCalculator.vue'
import instanceInfo from '../views/instanceInfo.vue'
import role from '../views/role.vue'
import weapon from '../views/weapon.vue'
import spirit from '../views/spirit.vue'
import other from '../views/other.vue'
import DataImportOCR from '../views/DataImportOCR.vue'


const routes = [
  { path: '/', component: Home },
  { path: '/page1', component: Page1 },
  { path: '/page2', component: Page2 },
  { path: '/page3', component: Page3 },
  { path: '/ExpCalculator', component: ExpCalculator },
  { path: '/instanceInfo', component: instanceInfo },
  { path: '/about', component: about },
  { path: '/role', component: role },
  { path: '/weapon', component: weapon },
  { path: '/spirit', component: spirit },
  { path: '/other', component: other },
  { path: '/DataImportOCR', component: DataImportOCR },
]

export default createRouter({
  history: createWebHistory(),
  routes
})
