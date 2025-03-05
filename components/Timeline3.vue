<template>
  <!-- Time timeline -->
  <div class="h-8">
    <!-- Timeline-->
    <div class="flex">
      <div class="pin-group">
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
      </div>
      <div class="pin-group">
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
      </div>
      <div class="pin-group">
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
      </div>
      <div class="pin-group">
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-red"></div>
        <div class="pin-orange"></div>
        <div class="pin-orange"></div>
        <div class="pin-orange"></div>
        <div class="pin-orange"></div>
      </div>
      <div class="pin-group">
        <div class="pin-orange"></div>
        <div class="pin-orange"></div>
        <div class="pin-orange"></div>
        <div class="pin-red"></div>
        <div class="pin-red"></div>
        <div class="pin-orange"></div>
        <div class="pin-green"></div>
      </div>
      <div class="pin-group">
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-green"></div>
        <div class="pin-orange"></div>
        <div class="pin-green"></div>
      </div>
      <!-- Collapse -->
      <div class="flex">
        <!-- Collapse trigger -->
        <button
          type="button"
          class="hs-collapse-toggle flex gap-x-0.5 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-700 group"
          aria-expanded="false"
          id="hs-basic-collapse-p3"
          aria-controls="hs-basic-collapse-content-p3"
          data-hs-collapse="#hs-basic-collapse-content-p3"
        >
          <div
            class="w-5 h-5 text-[10px] text-center text-white flex items-center justify-center rounded-full bg-neutral-400 dark:bg-neutral-700 group-hover:bg-neutral-500 dark:group-hover:bg-neutral-800"
          >
            <Icon
              class="hs-collapse-open:rotate-180 size-4 transition-all duration-300"
              name="lucide:chevron-down"
            />
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup></script>

<style scoped>
.pin-group {
  @apply flex gap-x-0.5 p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-gray-700;
}
.pin-green {
  @apply w-1.5 h-5 rounded-full bg-green-400 dark:bg-green-900;
}
.pin-orange {
  @apply w-1.5 h-5 rounded-full bg-orange-300 dark:bg-orange-500;
}
.pin-red {
  @apply w-1.5 h-5 rounded-full bg-red-600;
}
.pin-neutral {
  @apply w-1.5 h-5 rounded-full bg-neutral-400 dark:bg-neutral-600;
}
</style>
