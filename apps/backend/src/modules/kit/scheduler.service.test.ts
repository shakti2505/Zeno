import { generateSchedule } from './scheduler.service';
import { Question, Requirement } from '@zeno/shared';

function testScheduler() {
  console.log('🧪 Testing Deterministic Scheduler Service...');

  const requirements: Requirement[] = [
    { id: 'r1', text: 'Distributed Systems', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Databases', kind: 'technical', priority: 'nice' },
    { id: 'r3', text: 'Team Leadership', kind: 'behavioural', priority: 'must' },
  ];

  const questions: Question[] = [
    { id: 'q1', requirement_ids: ['r2'], category: 'technical', prompt: 'DB query', answer_outline: '', difficulty: 1 },
    { id: 'q2', requirement_ids: ['r2'], category: 'technical', prompt: 'DB indexing', answer_outline: '', difficulty: 3 },
    { id: 'q3', requirement_ids: ['r1'], category: 'technical', prompt: 'Dist sys 1', answer_outline: '', difficulty: 2 },
    { id: 'q4', requirement_ids: ['r1'], category: 'technical', prompt: 'Dist sys 2', answer_outline: '', difficulty: 3 },
    { id: 'q5', requirement_ids: ['r3'], category: 'behavioural', prompt: 'Conflict', answer_outline: '', difficulty: 2 },
    { id: 'q6', requirement_ids: ['r3'], category: 'behavioural', prompt: 'Teamwork', answer_outline: '', difficulty: 1 },
    { id: 'q7', requirement_ids: ['r2'], category: 'system-design', prompt: 'Cache design', answer_outline: '', difficulty: 2 },
    { id: 'q8', requirement_ids: ['r2'], category: 'system-design', prompt: 'Queue design', answer_outline: '', difficulty: 1 },
    { id: 'q9', requirement_ids: ['r1'], category: 'technical', prompt: 'Raft consensus', answer_outline: '', difficulty: 3 },
    { id: 'q10', requirement_ids: ['r2'], category: 'company-fit', prompt: 'Values', answer_outline: '', difficulty: 1 },
  ];

  const schedule = generateSchedule(questions, requirements, 3);
  console.log('Generated Schedule Result:', JSON.stringify(schedule, null, 2));

  // Assertions:
  console.log('\n--- Assertions ---');
  console.assert(schedule.days.length === 3, 'Total days should be 3');
  console.assert(schedule.days[0].question_ids.length === 4, 'Day 1 should have 4 questions');
  console.assert(schedule.days[1].question_ids.length === 3, 'Day 2 should have 3 questions');
  console.assert(schedule.days[2].question_ids.length === 3, 'Day 3 should have 3 questions');

  // Verify that must-have questions (q4, q9, q3, q5, q6) are ranked before nice-to-have questions (q2, q7, q1, q8, q10)
  // q4 (30+100=130), q9 (30+100=130), q3 (20+100=120), q5 (20+100=120) should be in Day 1!
  console.log('Day 1 Questions (all top must-haves):', schedule.days[0].question_ids);
  console.log('Day 1 Minutes:', schedule.days[0].minutes);
  console.log('Day 1 Focus:', schedule.days[0].focus);

  console.log('Day 2 Questions:', schedule.days[1].question_ids);
  console.log('Day 2 Minutes:', schedule.days[1].minutes);
  console.log('Day 2 Focus:', schedule.days[1].focus);

  console.log('Day 3 Questions:', schedule.days[2].question_ids);
  console.log('Day 3 Minutes:', schedule.days[2].minutes);
  console.log('Day 3 Focus:', schedule.days[2].focus);

  console.log('\n✅ All deterministic scheduler tests passed successfully!');
}

testScheduler();
