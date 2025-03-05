<template>
  <!-- Product item -->
  <div class="flex flex-col mb-4">
    <div class="flex w-full flex-row gap-2">
      <div class="flex">
        <!-- Button & name -->
        <div class="mr-2 pt-2">
          <button
            type="button"
            class="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
          >
            <Icon class="size-4" name="lucide:box" />
          </button>
        </div>
        <div class="flex w-full flex-col pt-2">
          <div class="font-medium pt-0.5">BRAMS ams 15 km</div>
          <div class="flex flex-col items-center">
            <div class="w-40 text-xs leading-none">
              78% <span class="text-neutral-200">•</span> 21 mar. 11:17
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-col w-full">
        <div class="flex justify-between w-full">
          <!-- Line Progress -->
          <div class="flex flex-grow flex-col">
            <!-- Barra de turno -->
            <Turn3 />
            <!-- Time timeline -->
            <Timeline3 />
          </div>
          <div class="text-xs py-1.5 flex items-center leading-none">
            <div
              class="inline-flex py-2 px-2.5 rounded-md bg-red-100 dark:bg-red-600"
            >
              <span
                class="text-[10px] text-nowrap uppercase text-red-500 dark:text-white"
                >P. Urgente</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Collapse Content -->
    <div
      id="hs-basic-collapse-content-p3"
      aria-labelledby="hs-basic-collapse-p3"
      class="hs-collapse hidden w-full overflow-hidden transition-[height] duration-300"
    >
      <Calendar />
    </div>
  </div>
</template>

<script lang="ts" setup></script>
