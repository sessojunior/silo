<template>
  <!-- Time timeline -->
  <div class="h-8">
    <!-- Timeline-->
    <div class="flex">
      <div class="flex gap-x-0.5 p-1.5 rounded-md hover:bg-orange-50">
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
      </div>
      <div class="flex gap-x-0.5 p-1.5 rounded-md hover:bg-orange-50">
        <div class="w-1.5 h-5 rounded-full bg-orange-300"></div>
        <div class="w-1.5 h-5 rounded-full bg-orange-300"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
      </div>
      <div class="flex gap-x-0.5 p-1.5 rounded-md hover:bg-orange-50">
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
      </div>
      <div class="flex gap-x-0.5 p-1.5 rounded-md hover:bg-orange-50">
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-red-400"></div>
        <div class="w-1.5 h-5 rounded-full bg-orange-300"></div>
      </div>
      <div class="flex gap-x-0.5 p-1.5 rounded-md hover:bg-orange-50">
        <div class="w-1.5 h-5 rounded-full bg-orange-300"></div>
        <div class="w-1.5 h-5 rounded-full bg-orange-300"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
      </div>
      <div class="flex gap-x-0.5 p-1.5 rounded-md hover:bg-orange-50">
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-orange-300"></div>
        <div class="w-1.5 h-5 rounded-full bg-orange-300"></div>
        <div class="w-1.5 h-5 rounded-full bg-red-400"></div>
        <div class="w-1.5 h-5 rounded-full bg-red-400"></div>
        <div class="w-1.5 h-5 rounded-full bg-orange-200"></div>
        <div class="w-1.5 h-5 rounded-full bg-green-200"></div>
      </div>
      <!-- Collapse -->
      <div class="flex">
        <!-- Collapse trigger -->
        <button
          type="button"
          class="hs-collapse-toggle flex gap-x-0.5 p-1.5 rounded-full hover:bg-neutral-100 group"
          aria-expanded="false"
          id="hs-basic-collapse-p2"
          aria-controls="hs-basic-collapse-content-p2"
          data-hs-collapse="#hs-basic-collapse-content-p2"
        >
          <div
            class="w-5 h-5 text-[10px] text-center text-white flex items-center justify-center rounded-full bg-neutral-200 group-hover:bg-neutral-400"
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
