// Starter library: original lines written for this app.
// Transcript-inspired lines get appended later by scripts (see README).
// {thing} is replaced with the most specific thing the user mentioned.

import type {PersonaId} from './personas';

export type Topic =
  | 'work' | 'boss' | 'money' | 'love' | 'parents' | 'marriage' | 'food' | 'gym'
  | 'sleep' | 'tech' | 'study' | 'traffic' | 'friends' | 'phone' | 'self' | 'any';

export type Joke = {text: string; topic: Topic};
export type Comeback = {persona: PersonaId; topics: Topic[]; line: string};

export const JOKES: Joke[] = [
  {topic: 'work', text: "My company calls it 'unlimited leave'. It's like a buffet where your manager stands next to the food and watches you eat."},
  {topic: 'work', text: "Every office has a 'quick five-minute call' that started in 2021. Some people on it have since had children."},
  {topic: 'work', text: "My appraisal said 'meets expectations'. That's HR for 'we expected nothing, and you delivered'."},
  {topic: 'work', text: "Work from home was great until my boss could see my ceiling fan and judge it."},
  {topic: 'work', text: "Office birthdays are basically a hostage situation: everyone stands in a circle, someone cuts a cake, nobody is allowed to leave."},
  {topic: 'love', text: "Dating apps are just LinkedIn with worse lighting. Everyone is 'passionate about travel' and nobody has left their city since 2019."},
  {topic: 'love', text: "My ex and I still talk. Mostly through Instagram stories we both pretend not to watch."},
  {topic: 'love', text: "In India you don't 'meet the parents'. The parents meet you. With a questionnaire, a horoscope and a cousin who works in HR."},
  {topic: 'love', text: "She said she wanted someone who makes her laugh. I did. At the wedding. Hers."},
  {topic: 'love', text: "A situationship is all the anxiety of a relationship with none of the paperwork."},
  {topic: 'parents', text: "Indian moms have two volumes: silent, and 'I'm not angry, I'm just telling'."},
  {topic: 'parents', text: "My dad's entire career advice: do what you love, but also become an engineer."},
  {topic: 'parents', text: "Relatives ask 'what's your package?' like I'm a courier."},
  {topic: 'parents', text: "My mom forwards me messages marked URGENT: MUST READ. It's always about drinking warm water."},
  {topic: 'parents', text: "Every Indian family has one uncle who 'knows a guy'. For everything. Visa, wedding hall, kidney."},
  {topic: 'money', text: "I don't have a budget. I have a series of small surprises every time I open my bank app."},
  {topic: 'money', text: "My salary is like a WhatsApp forward: it arrives, gets shared with everyone, and nobody remembers it two days later."},
  {topic: 'money', text: "I invested in mutual funds. Now my money and I are both waiting for the market to 'recover'."},
  {topic: 'money', text: "Rent in Bangalore is so high my landlord asked for a deposit, two months' rent and a reference from my previous landlord's therapist."},
  {topic: 'money', text: "Every month I promise to save. Then an app says 'Flat 60% off' and I remember I'm only human."},
  {topic: 'tech', text: "My phone's face unlock doesn't recognise me in the morning. Honestly, fair."},
  {topic: 'tech', text: "Nothing humbles you like your phone saying 'screen time up 12%'. Up from what? Being a person?"},
  {topic: 'tech', text: "I asked an AI to write my wedding speech. It said it doesn't have personal opinions about love. Same, bro."},
  {topic: 'tech', text: "WhatsApp family groups are where good-morning images go to retire."},
  {topic: 'tech', text: "I turned on Do Not Disturb and my anxiety took it personally."},
  {topic: 'self', text: "A gym membership is the most expensive way to feel guilty in January."},
  {topic: 'self', text: "I'm at the age where 'going out' means going out to the balcony."},
  {topic: 'self', text: "Adulthood is googling 'is it normal if…' at 2 a.m. and getting a Reddit thread from 2014."},
  {topic: 'self', text: "Every Monday I start a new life. By Wednesday I've cancelled the subscription."},
  {topic: 'self', text: "I don't overthink. I think, then think about having thought, then make tea and think about that."},
];

export const COMEBACKS: Comeback[] = [
  // Dr. House
  {persona: 'house', topics: ['work', 'boss'], line: "Your manager isn't the problem. He's just the only person who has to read your work. That's a hardship posting."},
  {persona: 'house', topics: ['love'], line: "You're not heartbroken. You're bored, and someone stopped feeding your ego. Get a hobby. A cheaper one."},
  {persona: 'house', topics: ['parents', 'marriage'], line: "Your family loves you unconditionally. Which is lucky, because conditions would not have worked out for you."},
  {persona: 'house', topics: ['sleep', 'phone'], line: "You don't have insomnia. You have a glowing rectangle you love more than people, and honestly, I get it."},
  {persona: 'house', topics: ['food', 'gym'], line: "You're not on a diet. You're on a schedule of lying to yourself between meals."},
  {persona: 'house', topics: ['self', 'any'], line: "Everybody lies. You just lied about {thing}, and you didn't even need to. Impressive. Pointless, but impressive."},
  {persona: 'house', topics: ['any'], line: "Interesting. And by interesting I mean I've already lost interest. Next."},
  {persona: 'house', topics: ['money'], line: "Your bank balance and your personality have one thing in common: both look better if nobody checks."},
  {persona: 'house', topics: ['any'], line: "So, {thing}. I'd explain why that's a bad idea, but you'd have to understand it, and we're both busy."},
  {persona: 'house', topics: ['friends'], line: "Your friends aren't toxic. They're a control group. You're the experiment that keeps failing."},
  {persona: 'house', topics: ['self', 'any'], line: "I'm not judging you. I did that the moment you walked in. Now I'm just confirming."},
  {persona: 'house', topics: ['any'], line: "You said {thing} like you expected sympathy. Wrong door. Sympathy is down the hall, next to the people who care."},
  {persona: 'house', topics: ['love'], line: "Relationships are just two people agreeing to be disappointed in the same place. Very efficient."},
  {persona: 'house', topics: ['work'], line: "You don't hate your job. You hate that you're bad at it and everyone noticed. Different problem. Same commute."},
  {persona: 'house', topics: ['money', 'self'], line: "Symptoms: buying things you don't need to impress people you don't like. Prognosis: you'll do it again on Friday."},
  {persona: 'house', topics: ['study'], line: "You topped your class? Congratulations, you were the best at doing exactly what you were told. Thrilling."},

  // Checkmate
  {persona: 'checkmate', topics: ['work', 'boss'], line: '… So you went to work again. Voluntarily. That\'s not a career, that\'s a blunder you keep replaying.'},
  {persona: 'checkmate', topics: ['love'], line: '… You were in a relationship with only one move: hope. Bro, hope is not an opening.'},
  {persona: 'checkmate', topics: ['parents', 'marriage'], line: 'Indian parents play chess differently. They don\'t checkmate you. They just keep you in check for 30 years.'},
  {persona: 'checkmate', topics: ['money'], line: '… Your savings are like my opponents. Gone in the first ten moves.'},
  {persona: 'checkmate', topics: ['study'], line: 'You studied all night and still failed. That\'s not bad luck. That\'s a forced mate in two.'},
  {persona: 'checkmate', topics: ['any'], line: '… {thing}. Hmm. I\'ve seen worse positions. Not many. But some.'},
  {persona: 'checkmate', topics: ['self', 'any'], line: 'You hung your queen on move three and now you\'re asking for advice. … Resign. Respectfully.'},
  {persona: 'checkmate', topics: ['friends'], line: 'Your friends are like pawns. They move forward only when it\'s convenient and die first.'},
  {persona: 'checkmate', topics: ['any'], line: '… Okay. I was going to say something nice. Then I remembered who I am.'},
  {persona: 'checkmate', topics: ['phone', 'tech'], line: 'Your screen time is higher than my Elo. And my Elo has a family to feed.'},

  // Corporate Hater: jokes about corporate life itself, in plain words
  {persona: 'corporate', topics: ['boss'], line: "Your manager isn't evil. He's just a guy who got promoted for being in the room when the last manager quit."},
  {persona: 'corporate', topics: ['work'], line: 'An office is just a building where adults get paid to pretend the meeting could not have been an email.'},
  {persona: 'corporate', topics: ['money', 'work'], line: 'A 4% hike when rent went up 10%. So technically your company paid you to get poorer. Loyalty, rewarded.'},
  {persona: 'corporate', topics: ['work', 'any'], line: "So {thing}. And let me guess, they still want you to fill the engagement survey saying you're happy."},
  {persona: 'corporate', topics: ['boss', 'work'], line: "Every company says 'we're a family' right up until the layoff, which is the most family thing they do. Abandonment."},
  {persona: 'corporate', topics: ['tech', 'work'], line: "They bought an AI tool to save time. Now there's a weekly meeting about the AI tool. Progress."},
  {persona: 'corporate', topics: ['any'], line: 'You know what fixes {thing}? Nothing. But HR will send a wellness webinar at 6 p.m. to talk about it.'},
  {persona: 'corporate', topics: ['work'], line: 'Startups pay you in ESOPs, pizza and the promise that next year will be different. The pizza was real, at least.'},
  {persona: 'corporate', topics: ['self', 'work'], line: "Monday you plan to change your life. Wednesday you're in a meeting about meetings. Friday you're just grateful it's Friday."},
  {persona: 'corporate', topics: ['work', 'friends'], line: "Office friends are real friends, until one of you resigns. Then you're just two people who liked the same canteen."},
  {persona: 'corporate', topics: ['work'], line: 'Appraisal season is when your manager finds out what you did all year, from you, on a form, in the last 20 minutes.'},
  {persona: 'corporate', topics: ['work', 'traffic'], line: 'Two hours of commute for a job you could do from bed. But sure, culture. The culture is traffic.'},

  // Out of Office (formerly Couldn't Care Less)
  {persona: 'corporate', topics: ['any'], line: 'Okay.'},
  {persona: 'corporate', topics: ['any'], line: '{thing}? Wild. Anyway, do you think samosas count as breakfast?'},
  {persona: 'corporate', topics: ['work', 'boss'], line: 'Your boss is angry. Cool. I\'m horizontal. We\'re both committed to our positions.'},
  {persona: 'corporate', topics: ['love'], line: 'They left? Hm. Did they take the charger? No? Then honestly, you\'re fine.'},
  {persona: 'corporate', topics: ['money'], line: 'Broke? Same. I\'m saving money by not caring. Very cheap hobby.'},
  {persona: 'corporate', topics: ['self', 'any'], line: 'That sounds like a lot. I\'ll think about it later. I won\'t, but I\'ll say that.'},
  {persona: 'corporate', topics: ['parents'], line: 'Your parents are disappointed. Mine too. Let\'s start a club. Meetings are cancelled.'},
  {persona: 'corporate', topics: ['study', 'work'], line: 'Deadlines are just suggestions written by people who wake up early.'},
  {persona: 'corporate', topics: ['any'], line: 'Wow. Riveting. I\'ve fallen asleep twice reading that, which is honestly a compliment.'},
  {persona: 'corporate', topics: ['food'], line: 'Finally, a topic I care about. Just kidding. Unless there\'s maggi. Is there maggi?'},

  // No Filter
  {persona: 'nofilter', topics: ['self', 'any'], line: 'You said {thing} like it was a flex. Sir, that was a confession.'},
  {persona: 'nofilter', topics: ['love'], line: 'They didn\'t break your heart. They just finally read your texts in one go.'},
  {persona: 'nofilter', topics: ['work', 'boss'], line: 'Your boss isn\'t the problem. Your boss is the only one who\'s met your work. That\'s the problem.'},
  {persona: 'nofilter', topics: ['gym'], line: 'You go to the gym? Bro, the gym knows you as "January".'},
  {persona: 'nofilter', topics: ['money'], line: 'You\'re not broke. You just have expensive taste and the salary of a decorative plant.'},
  {persona: 'nofilter', topics: ['friends'], line: 'Every group has one friend who\'s the punchline. Hi.'},
  {persona: 'nofilter', topics: ['any'], line: 'I\'ve heard better stories from a traffic signal. At least it changes.'},
  {persona: 'nofilter', topics: ['parents', 'marriage'], line: 'Your mom says you\'re special. That\'s a diagnosis, not a compliment.'},
  {persona: 'nofilter', topics: ['study'], line: 'You topped your class? In a class of what, two? Was the other one sick?'},
  {persona: 'nofilter', topics: ['any'], line: 'Who hurt you? Never mind, I can tell from how you typed {thing}.'},

  // Wilde Card: intellectual wit
  {persona: 'wit', topics: ['work'], line: "Work is wonderful. I could sit and watch other people do it for hours. You appear to have chosen the other side of that arrangement."},
  {persona: 'wit', topics: ['love'], line: "Romance is the triumph of imagination over evidence. Yours, I gather, has been rather badly outnumbered."},
  {persona: 'wit', topics: ['money'], line: "Money cannot buy happiness, but it does fund an excellent search party. You, it seems, are searching on foot."},
  {persona: 'wit', topics: ['parents', 'marriage'], line: "Families are like footnotes: essential, unavoidable, and nobody reads them voluntarily."},
  {persona: 'wit', topics: ['self', 'any'], line: "You have the rare gift of saying {thing} as though it were a conclusion. It is, at best, a rough draft."},
  {persona: 'wit', topics: ['any'], line: "How refreshing. Most people think before they speak. You have spared us the delay."},
  {persona: 'wit', topics: ['study'], line: "Education is what remains after one has forgotten everything one learned. In that sense you are extraordinarily well educated."},
  {persona: 'wit', topics: ['tech', 'phone'], line: "We built a machine that holds all human knowledge, and we use it to watch strangers make dosas. Progress is a circle with good lighting."},
  {persona: 'wit', topics: ['food'], line: "A diet is merely a promise one makes to a future self who has never once kept an appointment."},
  {persona: 'wit', topics: ['friends'], line: "True friends stab you in the front. Yours, I suspect, are still deciding which side is the front."},
  {persona: 'wit', topics: ['any'], line: "{thing}. Fascinating. I shall remember it the way one remembers a weather forecast: briefly, and with mild regret."},
  {persona: 'wit', topics: ['boss'], line: "A manager is someone who believes that nine women can deliver a baby in one month, provided the meeting is well attended."},
  // Smart Alec: science, literal readings, smart puns
  {persona: 'wit', topics: ['self', 'any'], line: "You said you 'literally died'. You are typing. Either you are using the word wrong or this is a very significant medical event."},
  {persona: 'wit', topics: ['work'], line: "Technically your job is a closed system: energy goes in, nothing useful comes out, and the temperature in meetings keeps rising. That's thermodynamics."},
  {persona: 'wit', topics: ['love'], line: "Statistically, there is someone out there for everyone. Statistically, they are also in another time zone and asleep."},
  {persona: 'wit', topics: ['money'], line: "Your bank balance and absolute zero have a lot in common: both are theoretical limits, and you keep getting closer."},
  {persona: 'wit', topics: ['sleep'], line: "You don't have insomnia. You have a phone, a ceiling and a strong belief that 2 a.m. is when life decisions should be made."},
  {persona: 'wit', topics: ['any'], line: "I'd agree with you about {thing}, but then we'd both be wrong, and I have a reputation."},
  {persona: 'wit', topics: ['food'], line: "Calories are just tiny units of energy. So technically, that second samosa was a renewable resource."},
  {persona: 'wit', topics: ['tech'], line: "There are 10 kinds of people in the world: those who understand binary, and those who are about to ask me to explain this joke."},
  {persona: 'wit', topics: ['parents'], line: "Your parents said you could be anything. Technically correct. They just didn't specify 'anything good'."},
  {persona: 'wit', topics: ['any'], line: "I'm reading a book about anti-gravity. Impossible to put down. Rather like {thing}, though for the opposite reason."},
  // No Filter: allowed to swear when it lands
  {persona: 'nofilter', topics: ['work'], line: "You work at {thing}? Damn. And here I was thinking my life choices were bad."},
  {persona: 'nofilter', topics: ['love'], line: "You're not unlucky in love. You just keep falling for people who treat you like a fucking free trial."},
  {persona: 'nofilter', topics: ['self', 'any'], line: "{thing}? That's not a personality, that's a cry for help with good lighting."},
  {persona: 'nofilter', topics: ['money'], line: "Your financial plan is just 'next month will be different', said with your whole damn chest. Every month."},
];
