<template>
  <div>
    <h2>喵~</h2>
    <button @click="openLink">去皎皎角查看</button>
  </div>
</template>

<script setup>
const openLink = () => {
  window.open('https://dnabbs.yingxiong.com/', '_blank')
}
</script>