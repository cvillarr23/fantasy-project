import React from 'react';
import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import type {EnvReference as Reference, EnvVariable} from '@site/scripts/env-reference.mjs';
import styles from './styles.module.css';

const repoLabels: Record<string, string> = {core: 'core', worker: 'worker', ui: 'web-ui'};

// Shared variables first, since they have to agree across services.
const groups: {title: string; id: string; matches: (v: EnvVariable) => boolean}[] = [
  {title: 'Shared by several services', id: 'shared', matches: (v) => v.repos.filter((r) => r !== 'platform').length > 1},
  {title: 'Core pipeline', id: 'core', matches: (v) => v.repos.length === 1 && v.repos[0] === 'core'},
  {title: 'Browser worker', id: 'worker', matches: (v) => v.repos.length === 1 && v.repos[0] === 'worker'},
  {title: 'Web UI', id: 'web-ui', matches: (v) => v.repos.length === 1 && v.repos[0] === 'ui'},
  {title: 'Platform images and libraries', id: 'platform', matches: (v) => v.repos.includes('platform')},
];

function ReadIn({variable}: {variable: EnvVariable}) {
  const byRepo = new Map<string, EnvVariable['readIn']>();
  for (const read of variable.readIn) byRepo.set(read.repo, [...(byRepo.get(read.repo) ?? []), read]);
  if (byRepo.size === 0) return null;
  return (
    <span className={styles.meta}>
      Read in{' '}
      {[...byRepo.entries()].map(([repo, reads], index) => (
        <React.Fragment key={repo}>
          {index > 0 && ', '}
          <Link href={reads[0].url}>{repoLabels[repo] ?? repo}/{reads[0].file}:{reads[0].line}</Link>
          {reads.length > 1 && ` and ${reads.length - 1} more`}
        </React.Fragment>
      ))}
    </span>
  );
}

function Labels({variable}: {variable: EnvVariable}) {
  const labels = [];
  if (variable.secret) labels.push('Secret');
  // undefined without the infra checkout; null when fantasy-infra doesn't set it.
  if (variable.production) labels.push(variable.production.secret ? 'Set in production from a Secret' : 'Set in production');
  if (labels.length === 0) return null;
  return <span className={styles.meta}>{labels.join(' · ')}</span>;
}

export default function EnvReference() {
  const {variables, complete} = usePluginData('env-reference') as Reference;
  return (
    <>
      {!complete && (
        <div className="alert alert--info" role="note">
          This build doesn't include the source checkouts, so the tables show the hand-written
          reference only, without the source locations or what production sets.
        </div>
      )}
      {groups.map((group) => {
        const rows = variables.filter(group.matches);
        if (rows.length === 0) return null;
        return (
          <section key={group.id}>
            <h3 id={`env-${group.id}`}>{group.title}</h3>
            <table className={styles.table}>
              <colgroup>
                <col className={styles.name} />
                <col className={styles.required} />
                <col className={styles.default} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Required</th>
                  <th>Default</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((variable) => (
                  <tr key={variable.name} id={`env-${variable.name.replace(/[{}]/g, '').toLowerCase()}`}>
                    <td>
                      <code>{variable.name}</code>
                      {variable.examples && <span className={styles.meta}>such as {variable.examples.join(', ')}</span>}
                      <Labels variable={variable} />
                    </td>
                    <td>{variable.required}</td>
                    <td>{variable.default === null ? '—' : <code>{variable.default}</code>}</td>
                    <td>
                      {variable.description}
                      {variable.docs && <> <Link to={variable.docs}>More</Link></>}
                      <ReadIn variable={variable} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}
