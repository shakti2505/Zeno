import {
  Question,
  Requirement,
  Schedule,
  ScheduleDay,
  ScheduleSchema,
} from '@zeno/shared';

/**
 * Maps question categories to clear, human-readable daily focus titles.
 */
function getCategoryFocusTitle(category: string): string {
  switch (category) {
    case 'technical':
      return 'Deep Dive: Technical';
    case 'system-design':
      return 'Deep Dive: System Design & Architecture';
    case 'behavioural':
      return 'Focus: Behavioural & STAR Scenarios';
    case 'company-fit':
      return 'Focus: Company Fit & Cultural Alignment';
    default:
      return `Deep Dive: ${category.charAt(0).toUpperCase() + category.slice(1)}`;
  }
}

/**
 * Determines the dominant focus area for a given day's questions.
 */
function determineDayFocus(dayQuestions: Question[], dayNumber: number): string {
  if (dayQuestions.length === 0) {
    return `Day ${dayNumber}: Comprehensive Review & Practice`;
  }

  const categoryCounts = new Map<string, number>();
  for (const q of dayQuestions) {
    const category = q.category || 'technical';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  let dominantCategory = dayQuestions[0].category || 'technical';
  let highestFrequency = 0;

  for (const [category, count] of categoryCounts.entries()) {
    if (count > highestFrequency) {
      highestFrequency = count;
      dominantCategory = category as any;
    }
  }

  return getCategoryFocusTitle(dominantCategory);
}

/**
 * Deterministic scheduling algorithm to allocate questions into a daily study schedule.
 * 
 * Rules:
 * 1. Priority scoring:
 *    - Base score = question.difficulty * 10
 *    - +100 score if ANY mapped requirement is 'must' priority
 * 2. Questions sorted descending by priority score (harder & must-have questions first).
 * 3. Distribution:
 *    - baseCount = Math.floor(questions.length / daysAvailable)
 *    - remainder = questions.length % daysAvailable
 *    - Earlier days receive remainder questions.
 * 4. Day formatting:
 *    - minutes = sum of (question.difficulty * 15) for all questions in the day
 *    - focus = formatted dominant category title
 *    - question_ids = list of question IDs
 */
export function generateSchedule(
  questions: Question[],
  requirements: Requirement[] = [],
  daysAvailable: number = 3
): Schedule {
  const sanitizedDays = Math.max(1, Math.floor(daysAvailable || 3));

  // 1. Create a lookup map of requirements by id
  const requirementMap = new Map<string, Requirement>();
  for (const req of requirements) {
    requirementMap.set(req.id, req);
  }

  // 2. Score and sort questions
  const scoredQuestions = (questions || []).map((question) => {
    let priorityScore = (question.difficulty || 1) * 10;

    const hasMustPriority = (question.requirement_ids || []).some((reqId) => {
      const req = requirementMap.get(reqId);
      return req?.priority === 'must';
    });

    if (hasMustPriority) {
      priorityScore += 100;
    }

    return {
      question,
      priorityScore,
    };
  });

  // Sort descending by priorityScore (highest priority & hardest first)
  scoredQuestions.sort((a, b) => b.priorityScore - a.priorityScore);
  const sortedQuestions = scoredQuestions.map((sq) => sq.question);

  // 3. Day Allocation Arithmetic
  const totalQuestions = sortedQuestions.length;
  const baseCount = Math.floor(totalQuestions / sanitizedDays);
  const remainder = totalQuestions % sanitizedDays;

  let currentIndex = 0;
  const scheduledDays: ScheduleDay[] = [];

  for (let dayIndex = 0; dayIndex < sanitizedDays; dayIndex++) {
    const dayNumber = dayIndex + 1;
    const questionsForThisDayCount = baseCount + (dayIndex < remainder ? 1 : 0);
    const dayQuestions = sortedQuestions.slice(
      currentIndex,
      currentIndex + questionsForThisDayCount
    );
    currentIndex += questionsForThisDayCount;

    // Calculate total minutes: difficulty * 15 for each question (ensure positive int)
    const rawMinutes = dayQuestions.reduce(
      (sum, q) => sum + (q.difficulty || 1) * 15,
      0
    );
    const minutes = Math.max(15, Math.round(rawMinutes));

    // Determine day focus based on the most frequent category
    const focus = determineDayFocus(dayQuestions, dayNumber);

    // Extract question ids
    const question_ids = dayQuestions.map((q) => q.id);

    scheduledDays.push({
      day: dayNumber,
      focus,
      question_ids,
      minutes,
    });
  }

  const schedulePayload: Schedule = {
    days_available: sanitizedDays,
    days: scheduledDays,
  };

  // Validate against strict Zod ScheduleSchema
  return ScheduleSchema.parse(schedulePayload);
}

export default generateSchedule;
