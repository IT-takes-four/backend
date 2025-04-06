export const getCurrentTimestamp = (): number => Math.floor(Date.now() / 1000);

export const dateToTimestamp = (date: Date): number =>
  Math.floor(date.getTime() / 1000);

export const timestampToDate = (timestamp: number): Date =>
  new Date(timestamp * 1000);

export const millisecondToDate = (timestamp: number): Date =>
  new Date(timestamp);
