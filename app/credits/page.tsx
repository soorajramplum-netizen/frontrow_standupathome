import type {Metadata} from 'next';
import {Layout} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/VStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Link} from '@astryxdesign/core/Link';
import credits from '@/lib/pool/credits.json';
import {APP_NAME} from '@/lib/config';

export const metadata: Metadata = {title: `Credits · ${APP_NAME}`};

// The open sources that fill the gaps between my own lines. Their licences ask for credit, so it lives here.
export default function Credits() {
  return (
    <Layout height="auto" contentWidth={640} padding={4}>
      <VStack gap={4} paddingBlock={6} paddingInline={4}>
        <Link href="/">← Back to {APP_NAME}</Link>
        <Heading level={1}>Credits</Heading>
        <Text color="secondary" as="p">
          Most of the jokes on {APP_NAME} are my own lines. These open sources fill the gaps:
        </Text>
        <VStack gap={2}>
          {credits.map((c) => (
            <Text key={c.name} as="p">
              <Link href={c.url} target="_blank">
                {c.name}
              </Link>{' '}
              <Text type="inherit" color="secondary">
                ({c.license})
              </Text>
            </Text>
          ))}
        </VStack>
      </VStack>
    </Layout>
  );
}
