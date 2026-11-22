'use client';

import {useEffect, useState} from 'react';
import {Layout} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {Grid} from '@astryxdesign/core/Grid';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Button} from '@astryxdesign/core/Button';
import {Badge} from '@astryxdesign/core/Badge';
import {Icon} from '@astryxdesign/core/Icon';
import {Link} from '@astryxdesign/core/Link';
import {ArrowPathIcon, FaceSmileIcon} from '@heroicons/react/24/outline';
import {PERSONAS} from '@/lib/personas';
import {JOKES} from '@/lib/library';
import {TOPICS} from '@/lib/topics';

// Home sets get one extra topic the chat comics don't do.
const SET_TOPICS = [...TOPICS, {id: 'puns', label: 'Bad puns', pool: ['puns']}];
type SetTopic = string;
const getSetTopic = (id: string) => SET_TOPICS.find((t) => t.id === id)!;
import {APP_NAME, APP_TAGLINE, BYLINE, CREDIT_LINE} from '@/lib/config';

const NEXT_LABELS = ['Next bit', 'Another one. I can take it.', 'Okay, one more', 'Keep going', 'That was mid. Next.'];

// A joke as stored in public/pool/jokes.json: text, topic, source label.
type Joke = {t: string; k: string; s: string};
const SEED: Joke[] = JOKES.map((j) => ({t: j.text, k: j.topic, s: 'Front Row'}));

/** A set on one topic: our own bits first (in order), then the best of the pool, shuffled a little. */
function buildSet(topic: SetTopic, pool: Joke[]): Joke[] {
  const tags = [topic, ...getSetTopic(topic).pool];
  const own = SEED.filter((j) => tags.includes(j.k));
  const rest = pool.filter((j) => tags.includes(j.k) && j.s !== 'Front Row');
  const top = rest.slice(0, 60).sort(() => Math.random() - 0.5);
  return [...own, ...top];
}

// Keep the shuffled order stable while the visitor works through a set.
const setCache = new Map<string, Joke[]>();
function buildSetMemo(topic: SetTopic, pool: Joke[]) {
  const key = `${topic}:${pool.length}`;
  if (!setCache.has(key)) setCache.set(key, buildSet(topic, pool));
  return setCache.get(key)!;
}

export function Home() {
  const [pool, setPool] = useState<Joke[]>(SEED);
  const [topic, setTopic] = useState<SetTopic>('work');
  const [index, setIndex] = useState(0);
  const set = buildSetMemo(topic, pool);
  const joke = set[index % set.length];
  const [laughs, setLaughs] = useState(0);
  const [laughedAt, setLaughedAt] = useState<Joke | null>(null);

  useEffect(() => {
    try {
      setLaughs(Number(localStorage.getItem('fr-laughs') ?? 0));
    } catch {}
    // The big joke pool is a static file: cached by the browser and the CDN, no API involved.
    fetch('/pool/jokes.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Joke[]) => {
        if (Array.isArray(data) && data.length) setPool(data);
      })
      .catch(() => {});
  }, []);

  const next = () => setIndex((i) => i + 1);
  const choose = (t: SetTopic) => {
    setTopic(t);
    setIndex(0);
  };

  const gotMe = () => {
    if (laughedAt === joke) return;
    setLaughedAt(joke);
    const n = laughs + 1;
    setLaughs(n);
    try {
      localStorage.setItem('fr-laughs', String(n));
    } catch {}
  };

  return (
    <Layout height="auto" contentWidth={760} padding={4}>
      <VStack gap={8} paddingBlock={6} paddingInline={4}>
        <VStack gap={2}>
          <Text type="supporting" color="secondary">
            {CREDIT_LINE}
          </Text>
          <Text as="h1" type="display-3" size="4xl">
            {APP_NAME}
          </Text>
          <HStack gap={2} align="center" wrap="wrap">
            <Text type="large" color="secondary">
              {APP_TAGLINE}
            </Text>
            <Text type="large" color="accent" weight="semibold">
              {BYLINE}
            </Text>
          </HStack>
        </VStack>

        <Card elevation="med">
          <VStack gap={4}>
            <VStack gap={2}>
              <Text type="label" color="secondary">
                What's tonight's set about?
              </Text>
              <HStack gap={1.5} wrap="wrap">
                {SET_TOPICS.map((t) => (
                  <Button
                    key={t.id}
                    label={t.label}
                    size="sm"
                    variant={t.id === topic ? 'primary' : 'secondary'}
                    onClick={() => choose(t.id)}
                  />
                ))}
              </HStack>
            </VStack>
            <HStack justify="between" align="center">
              <Text type="label" color="secondary">
                Bit {index + 1}
              </Text>
              <Badge label={getSetTopic(topic).label} variant="neutral" />
            </HStack>
            <VStack gap={1}>
              {joke.t.split(/\n/).map((line, i) => (
                <Text key={i} type="large" size="2xl" weight="medium" as="p" textWrap="pretty">
                  {line}
                </Text>
              ))}
              <Text type="supporting" color="secondary">
                via {joke.s}
              </Text>
            </VStack>
            <HStack gap={2} wrap="wrap">
              <Button
                label={NEXT_LABELS[index % NEXT_LABELS.length]}
                variant="primary"
                icon={<Icon icon={ArrowPathIcon} />}
                onClick={next}
              />
              <Button
                label={laughedAt === joke ? 'Noted. You laughed.' : 'That got me'}
                variant="secondary"
                icon={<Icon icon={FaceSmileIcon} />}
                onClick={gotMe}
                isDisabled={laughedAt === joke}
              />
            </HStack>
            {laughs > 0 && (
              <Text type="supporting" color="secondary">
                Laughs on this device so far: {laughs}
              </Text>
            )}
          </VStack>
        </Card>

        <VStack gap={4}>
          <VStack gap={1}>
            <Heading level={2}>Private crowdwork</Heading>
            <Text color="secondary">
              Pick a comic and say anything. They will take it from there. Nothing you type is saved.
            </Text>
          </VStack>
          <Grid columns={{minWidth: 300, max: 2}} gap={3}>
            {PERSONAS.map((p) => (
              <ClickableCard key={p.id} label={`Talk to ${p.name}`} href={`/chat/${p.id}`} variant={p.tint}>
                <HStack gap={3} align="center">
                  <Avatar src={p.avatar} name={p.name} size="lg" tooltip={false} />
                  <VStack gap={0.5}>
                    <Heading level={3}>{p.name}</Heading>
                    <Text type="supporting" color="secondary" maxLines={2}>
                      {p.tagline}
                    </Text>
                  </VStack>
                </HStack>
              </ClickableCard>
            ))}
          </Grid>
        </VStack>

        <Card variant="muted">
          <VStack gap={2}>
            <Heading level={3}>Why this exists</Heading>
            <Text color="secondary" as="p" textWrap="pretty">
              I&apos;ve been doing improv, very unseriously, for three or four years. Somewhere along the way my
              friends started calling me &ldquo;90lph&rdquo;: ninety laughs per hour of conversation. They counted.
              I didn&apos;t ask them to, which is the most flattering kind of surveillance.
            </Text>
            <Text color="secondary" as="p" textWrap="pretty">
              Keeping all that to myself felt selfish, so I&apos;ve democratised my wit. Most of the jokes here are my
              own lines; a few were borrowed from the internet to fill the awkward silences.{' '}
              <Link href="/credits">Credits</Link>.
            </Text>
            <Text type="supporting" color="secondary">
              The comics are parodies of comedy styles. If something lands too hard, that&apos;s the persona, not you.
            </Text>
          </VStack>
        </Card>
      </VStack>
    </Layout>
  );
}
