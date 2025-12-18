<template>
  <div>
    <h2>分页3</h2>
    <button @click="sendData">请求 API</button>
  </div>
</template>

<script setup>
import axios from 'axios'

const sendData = async () => {
  const res = await axios.post('/api/check', {
    name: 'test',
    age: 18
  })
  console.log(res.data)
}
</script>
