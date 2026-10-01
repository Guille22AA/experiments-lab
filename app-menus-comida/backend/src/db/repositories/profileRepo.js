// Data access for the profile and its restrictions.
// Converts between database rows (snake_case, JSON text) and JS objects (camelCase).
import { db } from '../connection.js';
import { nowIso, parseJson, toJson } from '../../lib/json.js';

function rowToProfile(row) {
  return {
    peopleCount: row.people_count,
    mealsToPlan: parseJson(row.meals_to_plan, []),
    cookingMotivation: row.cooking_motivation,
    weekdayMinutes: row.weekday_minutes,
    weekendMinutes: row.weekend_minutes,
    skillLevel: row.skill_level,
    equipment: parseJson(row.equipment, []),
    likes: parseJson(row.likes, []),
    dislikes: parseJson(row.dislikes, []),
    batchCooking: Boolean(row.batch_cooking),
    usesLeftovers: Boolean(row.uses_leftovers),
    shoppingFrequencyDays: row.shopping_frequency_days,
    defaultSupermarketId: row.default_supermarket_id,
    extraNotes: parseJson(row.extra_notes, []),
    theme: row.theme,
    onboardingCompletedAt: row.onboarding_completed_at,
    updatedAt: row.updated_at,
  };
}

export function getProfile() {
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  const restrictions = db.prepare('SELECT code, kind, label, note FROM restrictions ORDER BY id').all();
  return { ...rowToProfile(row), restrictions };
}

/**
 * Saves the editable fields and replaces the restriction list.
 * Runs in a transaction so we never end up with half a profile.
 */
export const saveProfile = db.transaction((profile, { completeOnboarding = false } = {}) => {
  db.prepare(`
    UPDATE profile SET
      people_count = @peopleCount,
      meals_to_plan = @mealsToPlan,
      cooking_motivation = @cookingMotivation,
      weekday_minutes = @weekdayMinutes,
      weekend_minutes = @weekendMinutes,
      skill_level = @skillLevel,
      equipment = @equipment,
      likes = @likes,
      dislikes = @dislikes,
      batch_cooking = @batchCooking,
      uses_leftovers = @usesLeftovers,
      shopping_frequency_days = @shoppingFrequencyDays,
      extra_notes = @extraNotes,
      onboarding_completed_at = CASE WHEN @completeOnboarding THEN @now ELSE onboarding_completed_at END,
      updated_at = @now
    WHERE id = 1
  `).run({
    ...profile,
    mealsToPlan: toJson(profile.mealsToPlan),
    equipment: toJson(profile.equipment),
    likes: toJson(profile.likes),
    dislikes: toJson(profile.dislikes),
    extraNotes: toJson(profile.extraNotes),
    batchCooking: profile.batchCooking ? 1 : 0,
    usesLeftovers: profile.usesLeftovers ? 1 : 0,
    completeOnboarding: completeOnboarding ? 1 : 0,
    now: nowIso(),
  });

  db.prepare('DELETE FROM restrictions').run();
  const insert = db.prepare('INSERT INTO restrictions (kind, code, label, note) VALUES (@kind, @code, @label, @note)');
  for (const restriction of profile.restrictions) insert.run(restriction);

  return getProfile();
});

export function setTheme(theme) {
  db.prepare('UPDATE profile SET theme = ?, updated_at = ? WHERE id = 1').run(theme, nowIso());
}
