import {Suspense} from 'react';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {PERSONAS, getPersona} from '@/lib/personas';
import {APP_NAME} from '@/lib/config';
import {ChatRoom} from './chat-room';

export function generateStaticParams() {
  return PERSONAS.map((p) => ({persona: p.id}));
}

export async function generateMetadata(props: PageProps<'/chat/[persona]'>): Promise<Metadata> {
  const {persona} = await props.params;
  const p = getPersona(persona);
  return {title: p ? `${p.name} · ${APP_NAME}` : APP_NAME};
}

async function Room({params}: {params: PageProps<'/chat/[persona]'>['params']}) {
  const {persona} = await params;
  if (!getPersona(persona)) notFound();
  return <ChatRoom personaId={persona} />;
}

export default function Page(props: PageProps<'/chat/[persona]'>) {
  return (
    <Suspense fallback={null}>
      <Room params={props.params} />
    </Suspense>
  );
}
