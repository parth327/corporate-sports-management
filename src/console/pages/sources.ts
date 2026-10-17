import { api, type Resource } from '@/api';

/**
 * Dropdown sources shared by the declared CRUD screens.
 *
 * The engine's field declarations are loosely typed by design — a field list
 * is data, not generics — so each resource is widened once here rather than
 * cast at every use site.
 */

const asSource = <T,>(resource: Resource<T>) =>
  resource as unknown as Resource<Record<string, unknown>>;

export const SOURCE = {
  groups: asSource(api.groups),
  subGroups: asSource(api.subGroups),
  playerSubTypes: asSource(api.playerSubTypes),
  events: asSource(api.events),
  seasons: asSource(api.seasons),
  teams: asSource(api.teams),
};
