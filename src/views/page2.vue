<template>
  <div>
    <h2>分页2</h2>
    <button @click="sendData">请求 API</button>

    <hr style="margin: 20px 0;">

    <div v-if="apiResult" class="result-box">
      <h3>请求结果：</h3>
      
      <p><strong>状态:</strong> {{ apiResult.success ? '成功' : '失败' }}</p>
      <p><strong>IP地址:</strong> {{ apiResult.client_ip }}</p>
      <p><strong>消息:</strong> {{ apiResult.message }}</p>

      <details>
        <summary>查看原始 JSON</summary>
        <pre>{{ apiResult }}</pre>
      </details>
    </div>

    <div v-else-if="isLoading">正在加载中...</div>
  </div>
</template>

<script setup>
import { ref } from 'vue' // 必须引入 ref
import axios from 'axios'

// 2. 定义响应式变量
const apiResult = ref(null) // 初始值为 null
const isLoading = ref(false) // 加载状态

const sendData = async () => {
  // 请求开始，设置 loading
  isLoading.value = true
  apiResult.value = null // 清空旧数据
  
  try {
    const res = await axios.post('/api/check', {
      name: 'test测试内容',
      age: 18
    })
    
    // 3. 将返回的数据赋值给响应式变量
    // 注意：在 script 中修改 ref 必须加 .value
    apiResult.value = res.data
    
    console.log('数据已更新:', res.data)
  } catch (error) {
    console.error('请求出错:', error)
    alert('请求失败')
  } finally {
    // 请求结束 (无论成功失败)，关闭 loading
    isLoading.value = false
  }
}
</script>

<style scoped>
.result-box {
  background-color: #f4f4f4;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ddd;
  text-align: left; /* 让文字左对齐更好看 */
}

pre {
  background: #333;
  color: #fff;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto; /* 数据太长时允许横向滚动 */
}
</style>