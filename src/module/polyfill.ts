/**
 * @file Polyfills for the system
 */

export default () => {
  // @ts-ignore - Math.clamp is not a standard JS function
  if (typeof Math.clamp !== "function") {
    /**
     * Constrains a number between a minimum and maximum value, inclusively.
     * This was originally defined in FoundryVTT but was marked as deprecated
     * until v14 so let's redefine it in this pollyfill with a widely accepted
     * implementation.
     * 
     * @param value the value to clamp
     * @param min the minimum value, inclusive
     * @param max the maximum value, inclusive
     * @returns min if the value is less than min,
     * max if the value is greater than max,
     * or the value itself if it is within the range
     */
    // @ts-ignore - Math.clamp is not a standard JS function
    Math.clamp = function(value: number, min: number, max: number): number {
      return Math.min(Math.max(value, min), max);
    };
  }
};
