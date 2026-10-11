import React from 'react';
import Link from '@docusaurus/Link';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {usePluginData} from '@docusaurus/useGlobalData';
import '@asyncapi/react-component/styles/default.min.css';

export default function QueueContracts() {
  const {schema} = usePluginData('queue-contracts') as {schema: string | null};
  if (!schema) return <p>Queue contracts are unavailable in this checkout. Include the core repository with docs/asyncapi.yaml to render the explorer.</p>;
  // The browser bundle includes parser dependencies that otherwise need Node polyfills.
  return <><p><Link to="/core/queue-publishing">Delivery, idempotency and retry behavior</Link></p><BrowserOnly fallback={<p>Loading queue contracts…</p>}>
    {() => {
      const AsyncApi = require('@asyncapi/react-component/browser') as typeof import('@asyncapi/react-component').default;
      return <AsyncApi schema={schema} config={{show: {sidebar: false}, expand: {messageExamples: true}}} />;
    }}
  </BrowserOnly></>;
}
