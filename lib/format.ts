export const toTitleCase = (val: string): string =>
  val.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());