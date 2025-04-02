/**
 * シンプルなLRU（Least Recently Used）キャッシュの実装
 * 指定された容量とTTL（Time To Live）でキャッシュを管理する
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }>;
  private maxSize: number;
  private ttl: number; // ミリ秒単位のTTL

  /**
   * @param maxSize 最大エントリ数
   * @param ttl ミリ秒単位のTime To Live（0以下の場合は無期限）
   */
  constructor(maxSize: number, ttl = 0) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * キャッシュにデータを設定
   * @param key キー
   * @param value 値
   * @returns this（メソッドチェーン用）
   */
  set(key: K, value: V): this {
    // 容量制限に達した場合、最も古いエントリを削除
    if (this.cache.size >= this.maxSize) {
      const oldestKeyIterator = this.cache.keys().next();
      if (!oldestKeyIterator.done) {
        const oldestKey = oldestKeyIterator.value;
        this.cache.delete(oldestKey);
      }
    }

    // 新しいエントリを追加
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    return this;
  }

  /**
   * キャッシュからデータを取得
   * TTLが切れている場合はundefinedを返す
   * @param key キー
   * @returns 値またはundefined
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // TTLチェック
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // エントリを最新状態に更新（LRUの実装部分）
    this.cache.delete(key);
    this.cache.set(key, {
      value: entry.value,
      timestamp: Date.now(),
    });

    return entry.value;
  }

  /**
   * キャッシュにキーが存在するかチェック
   * TTLが切れている場合はfalseを返す
   * @param key キー
   * @returns 存在すればtrue
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // TTLチェック
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * キャッシュから指定したキーのエントリを削除
   * @param key キー
   * @returns 削除に成功したらtrue
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 古いエントリを削除
   * 現在のタイムスタンプとTTLを使って期限切れのエントリを削除
   * @returns 削除したエントリの数
   */
  prune(): number {
    if (this.ttl <= 0) return 0;

    const now = Date.now();
    let count = 0;

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        count++;
      }
    });

    return count;
  }

  /**
   * キャッシュのサイズを取得
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * キャッシュの統計情報を取得
   */
  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  /**
   * すべてのキーを取得
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * すべての値を取得
   */
  values(): V[] {
    const result: V[] = [];
    this.cache.forEach((entry) => {
      result.push(entry.value);
    });
    return result;
  }
}
