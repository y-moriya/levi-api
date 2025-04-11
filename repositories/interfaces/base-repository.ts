/**
 * すべてのリポジトリの基本インターフェース
 * @template T - エンティティの型
 * @template ID - エンティティIDの型
 */
export interface BaseRepository<T, ID> {
  /**
   * エンティティを追加
   * @param entity 追加するエンティティ
   * @returns 追加されたエンティティ
   */
  add(entity: T): Promise<T>;

  /**
   * エンティティを更新
   * @param id エンティティのID
   * @param entity 更新データ
   * @returns 更新されたエンティティ、存在しない場合はnull
   */
  update(id: ID, entity: T): Promise<T | null>;
  /**
   * IDによるエンティティの取得
   * @param id エンティティのID
   * @returns 見つかったエンティティ、存在しない場合はnullまたはundefined
   */
  findById(id: ID): Promise<T | null | undefined>;

  /**
   * IDによるエンティティの削除
   * @param id 削除するエンティティのID
   * @returns 削除に成功した場合はtrue
   */
  delete(id: ID): Promise<boolean>;

  /**
   * すべてのエンティティを取得
   * @returns エンティティの配列
   */
  findAll(): Promise<T[]>;

  /**
   * リポジトリの全データをクリア（主にテスト用）
   */
  clear(): Promise<void>;
}