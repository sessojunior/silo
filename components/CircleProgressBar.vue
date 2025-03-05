<template>
  <div class="flex relative justify-center items-center">
    <svg viewBox="-2 -2 106 106" :width="size" :height="size">
      <circle
        class="fill-transparent stroke-[var(--color-back)] dark:stroke-neutral-700"
        :stroke-width="props.strokeWidth"
        :stroke-dashoffset="0"
        :r="radius"
        cx="52"
        cy="52"
        :style="{ '--color-back': props.colorBack }"
      />
      <circle
        class="fill-transparent line-top"
        :stroke-width="props.strokeWidth"
        :class="fillingCircleClasses"
        :style="fillingCircleStyles"
        :transform="`rotate(${adjustedStartAngle} 52 52)`"
        ref="fillingCircle"
        :r="radius"
        cx="52"
        cy="52"
      />
    </svg>

    <div class="absolute inset-0 flex justify-center items-center flex-col">
      <span v-if="percentage">
        {{ getPercentage }}
      </span>
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";

const props = defineProps({
  max: {
    type: Number,
    required: true,
  },

  value: {
    type: Number,
    required: true,
  },

  colorFilled: {
    type: String,
    required: false,
    default: "#FF5533",
  },

  colorUnfilled: {
    type: String,
    required: false,
    default: "#3BB44A",
  },

  colorBack: {
    type: String,
    required: false,
    default: "#ECEEF1",
  },

  percentage: {
    type: Boolean,
    required: false,
    default: false,
  },

  rounded: {
    type: Boolean,
    required: false,
    default: false,
  },

  animationDuration: {
    type: String,
    required: false,
    default: "0.5s",
  },

  strokeWidth: {
    type: String,
    required: false,
    default: "5px",
  },

  reversedFilling: {
    type: Boolean,
    required: false,
    default: false,
  },

  size: {
    type: [String, Number],
    required: false,
    default: "124",
  },

  startAngle: {
    type: Number,
    required: false,
    default: 180,
  },
});

const isLimitReached = computed(() => props.max <= props.value);
const fillingCircleClasses = computed(() => {
  return {
    "line-top-rounded": props.rounded,
    "line-filled": isLimitReached.value,
    "line-unfilled": !isLimitReached.value,
  };
});

const fillingCircleStyles = computed(() => {
  return {
    strokeDashoffset: dashOffset.value,
    strokeDasharray: dashArray.value,
  };
});

const strokeWidthInt = parseInt(props.strokeWidth);
const adjustedRadius = 48 - (strokeWidthInt - 5) / 2;

const currentFormatted = computed(() =>
  isLimitReached.value ? props.max : props.value
);
const adjustedStartAngle = computed(() => props.startAngle - 90);

const fillingCircle = ref(null);
const radius = ref(adjustedRadius);
const dashArray = computed(() => radius.value * Math.PI * 2);
const dashOffset = computed(() => {
  if (props.reversedFilling)
    return (
      dashArray.value -
      (dashArray.value * (props.max - currentFormatted.value)) / props.max
    );
  return (
    dashArray.value - (dashArray.value * currentFormatted.value) / props.max
  );
});

const getPercentage = computed(() => {
  return Math.floor((props.value / props.max) * 100) + "%";
});
</script>

<style scoped>
@keyframes filling {
  from {
    stroke-dashoffset: v-bind("dashArray");
  }
  to {
    stroke-dashoffset: v-bind("dashOffset");
  }
}

.line-top {
  animation-name: filling;
  animation-duration: v-bind("props.animationDuration");
  animation-timing-function: ease-in;
  transition: 0.5s all;
}

.line-top-rounded {
  stroke-linecap: round;
}

.line-filled {
  stroke: v-bind("props.colorFilled");
}
.dark .line-filled {
  stroke: #262626 !important;
}

.line-unfilled {
  stroke: v-bind("props.colorUnfilled");
}
</style>
