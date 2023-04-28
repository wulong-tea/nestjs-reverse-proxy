export class JsonUtils {
  public static stringify(obj: any) {
    const cache = [];
    return JSON.stringify(obj, function (key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache.indexOf(value) !== -1) {
          return;
        }
        cache.push(value);
      }
      return value;
    });
  }
}
