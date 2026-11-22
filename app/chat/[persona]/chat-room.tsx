'use client';

import {useEffect, useState} from 'react';
import {
  ChatComposer,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatSystemMessage,
} from '@astryxdesign/core/Chat';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Divider} from '@astryxdesign/core/Divider';
import {ArrowLeftIcon} from '@heroicons/react/24/outline';
import {getPersona} from '@/lib/personas';
import {TOPICS, type TopicId} from '@/lib/topics';
import {extractThing} from '@/lib/text';
import {getSeen, loadEmbedder, markSeen} from '@/lib/embed-client';

type Msg = {role: 'user' | 'assistant'; content: string};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Comic timing: a reply "takes" about as long as a person would need to type it, with a beat before the punchline. */
function typingTime(reply: string) {
  return Math.min(4200, 900 + reply.length * 28);
}

export function ChatRoom({personaId}: {personaId: string}) {
  const persona = getPersona(personaId)!;
  const [messages, setMessages] = useState<Msg[]>([{role: 'assistant', content: persona.opener}]);
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [topic, setTopic] = useState<TopicId | null>(null);
  // Things the user has told us, for callbacks. Kept only in this browser tab.
  const [facts, setFacts] = useState<string[]>([]);
  // How the comic has been pacing things (probe / riff / land), so it doesn't joke on every line.
  const [beats, setBeats] = useState<string[]>([]);

  // Start loading the meaning model once the page is up, so it's ready by the first message.
  useEffect(() => {
    const start = () => void loadEmbedder();
    const w = window as Window & {requestIdleCallback?: (cb: () => void) => number};
    if (w.requestIdleCallback) w.requestIdleCallback(start);
    else setTimeout(start, 1500);
  }, []);

  async function pickTopic(id: TopicId) {
    if (isTyping) return;
    const t = TOPICS.find((x) => x.id === id)!;
    setTopic(id);
    setMessages((m) => [...m, {role: 'user', content: t.label}]);
    setIsTyping(true);
    const line = persona.topicOpeners[id];
    await sleep(typingTime(line));
    setMessages((m) => [...m, {role: 'assistant', content: line}]);
    setBeats((b) => [...b, 'probe']); // every topic opener ends on a question
    setIsTyping(false);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || isTyping) return;
    const next: Msg[] = [...messages, {role: 'user', content}];
    setMessages(next);
    setDraft('');
    const fact = extractThing(content);
    const nextFacts = fact && !facts.includes(fact) ? [...facts, fact].slice(-6) : facts;
    setFacts(nextFacts);
    setIsTyping(true);
    const started = Date.now();
    let reply = 'Mic cut out. Say that again?';
    try {
      // The message's meaning, if the model is ready within a second (it usually is); otherwise send without it.
      const embed = await Promise.race([loadEmbedder(), sleep(1000).then(() => null)]);
      const vec = embed ? await embed(content) : null;
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({persona: persona.id, messages: next, facts: nextFacts, beats, topic, vec, seen: getSeen()}),
      });
      const data = await res.json();
      if (data.beat) setBeats((b) => [...b, data.beat].slice(-8));
      if (data.id) markSeen(data.id);
      reply = data.reply ?? '… I had something. It left. Like your ex.';
    } catch {}
    await sleep(Math.max(0, typingTime(reply) - (Date.now() - started)));
    setMessages((m) => [...m, {role: 'assistant', content: reply}]);
    setIsTyping(false);
  }

  const avatar = <Avatar src={persona.avatar} name={persona.name} size="md" tooltip={false} />;
  const showTopics = topic === null && messages.length === 1;

  return (
    <VStack height="100dvh">
      <HStack gap={3} align="center" paddingInline={4} paddingBlock={3}>
        <Button label="All comics" href="/" variant="ghost" isIconOnly icon={<Icon icon={ArrowLeftIcon} />} />
        {avatar}
        <VStack gap={0}>
          <Heading level={1} type="display-3">
            {persona.name}
          </Heading>
          <Text type="supporting" color="secondary" maxLines={1}>
            {persona.tagline}
          </Text>
        </VStack>
      </HStack>
      <Divider />
      <ChatLayout
        density="balanced"
        composer={
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSubmit={send}
            placeholder={showTopics ? 'Pick a topic above, or just start talking' : persona.placeholder}
            isDisabled={isTyping}
          />
        }>
        <ChatMessageList isStreaming={isTyping}>
          <ChatSystemMessage variant="divider">Private crowdwork · nothing here is saved</ChatSystemMessage>
          {messages.map((m, i) =>
            m.role === 'assistant' ? (
              <ChatMessage key={i} sender="assistant" avatar={avatar} name={persona.name}>
                <ChatMessageBubble>{m.content}</ChatMessageBubble>
              </ChatMessage>
            ) : (
              <ChatMessage key={i} sender="user">
                <ChatMessageBubble>{m.content}</ChatMessageBubble>
              </ChatMessage>
            ),
          )}
          {showTopics && (
            <ChatMessage sender="assistant" avatar={avatar}>
              <HStack gap={1.5} wrap="wrap">
                {TOPICS.map((t) => (
                  <Button key={t.id} label={t.label} size="sm" variant="secondary" onClick={() => pickTopic(t.id)} />
                ))}
              </HStack>
            </ChatMessage>
          )}
          {isTyping && (
            <ChatMessage sender="assistant" avatar={avatar} name={persona.name}>
              <ChatMessageBubble variant="ghost">
                <Text color="secondary">typing…</Text>
              </ChatMessageBubble>
            </ChatMessage>
          )}
        </ChatMessageList>
      </ChatLayout>
    </VStack>
  );
}
