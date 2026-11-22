// The themes a visitor can pick, like choosing what the set is about tonight.
export type TopicId = 'work' | 'love' | 'family' | 'money' | 'tech' | 'life';

export const TOPICS: {id: TopicId; label: string; pool: string[]}[] = [
  // `pool` = topic tags used by the joke pool and the hand-written library
  {id: 'work', label: 'Work', pool: ['work', 'boss']},
  {id: 'love', label: 'Love & dating', pool: ['love', 'marriage']},
  {id: 'family', label: 'Family', pool: ['family', 'parents', 'marriage']},
  {id: 'money', label: 'Money', pool: ['money']},
  {id: 'tech', label: 'Phones & tech', pool: ['tech', 'phone']},
  {id: 'life', label: 'Life choices', pool: ['self', 'food', 'friends', 'health', 'school', 'gym', 'sleep', 'study', 'traffic']},
];

export const getTopic = (id: string) => TOPICS.find((t) => t.id === id);
