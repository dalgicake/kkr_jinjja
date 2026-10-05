// Service-role implementation of AccountStore (bypasses RLS — server only).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountStore } from './account.js';
import { StoreError, TEST_PHOTO_BUCKET, isInvalidTokenError } from './supabaseAdmin.js';

const PHOTO_PREFIX = `${TEST_PHOTO_BUCKET}/`;

export function createAccountStore(client: SupabaseClient): AccountStore {
  return {
    async getUserIdFromToken(accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error) {
        if (isInvalidTokenError(error)) return null;
        throw new StoreError('getUserIdFromToken', error.message);
      }
      return data.user?.id ?? null;
    },

    async listTestPhotoPaths(userId) {
      const { data, error } = await client
        .from('scans')
        .select('image_path')
        .eq('user_id', userId)
        .not('image_path', 'is', null);
      if (error) throw new StoreError('listTestPhotoPaths', error.message);
      return ((data ?? []) as { image_path?: unknown }[])
        .map((r) => r.image_path)
        .filter((p): p is string => typeof p === 'string' && p.startsWith(PHOTO_PREFIX));
    },

    async removeTestPhotos(paths) {
      const names = paths.map((p) => p.slice(PHOTO_PREFIX.length));
      const { error } = await client.storage.from(TEST_PHOTO_BUCKET).remove(names);
      if (error) throw new StoreError('removeTestPhotos', error.message);
    },

    async deleteUserRows(table, userId) {
      const { error } = await client.from(table).delete().eq('user_id', userId);
      if (error) throw new StoreError(`delete ${table}`, error.message);
    },

    async deleteProfile(userId) {
      const { error } = await client.from('profiles').delete().eq('id', userId);
      // before 0002_profiles.sql is applied the table doesn't exist: nothing to delete
      if (error && error.code !== '42P01' && error.code !== 'PGRST205')
        throw new StoreError('delete profiles', error.message);
    },

    async detachApiCalls(userId) {
      const { error } = await client
        .from('api_calls')
        .update({ user_id: null })
        .eq('user_id', userId);
      if (error) throw new StoreError('detachApiCalls', error.message);
    },

    async deleteAuthUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error && error.status !== 404) throw new StoreError('deleteAuthUser', error.message);
    },
  };
}
