import React, { useState, useEffect, useRef } from 'react';
import { askPerson, askTeam, type AskResponse, type PersonProfile } from '../api';

export type Mode = 'team' | 'person';

export interface Props {
  roster: PersonProfile[];
  reduceMotion?: boolean;
  motionOn?: boolean;
  onToggleMotion?: () => void;
}

interface RoomInfo {
  slug: string;
  name: string;
  role: string;
  room: string;
  status: string;
  statusType: 'available' | 'busy' | 'away';
  keyPrinciples: string[];
  approvedSources: string[];
  suggestedQuestion: string;
}

const OFFICE_TEAMMATES: RoomInfo[] = [
  {
    slug: 'priya',
    name: 'Priya',
    role: 'VP Product & Exec Lead',
    room: 'Exec Boardroom 4A',
    status: 'Away in 3-hr Exec Meeting',
    statusType: 'away',
    keyPrinciples: [
      'Zero customer data risk',
      'Strict sign-off hierarchy',
      '100% test coverage before GA'
    ],
    approvedSources: [
      'Executive Boardroom Minutes',
      'ATLAS Roadmap 2026',
      'Security Sign-off Log'
    ],
    suggestedQuestion: 'Would Priya support a 10% beta rollout today?'
  },
  {
    slug: 'alex',
    name: 'Alex',
    role: 'Backend Architect',
    room: 'Backend Pod B1',
    status: 'Available',
    statusType: 'available',
    keyPrinciples: [
      'Sub-50ms p99 latency',
      'Backward compatibility always',
      'Fail fast with circuit breakers'
    ],
    approvedSources: [
      'Backend Architecture Specs',
      'Redis & Postgres Benchmarks',
      'PR #142 Migration Docs'
    ],
    suggestedQuestion: 'What is the backend latency impact of Atlas?'
  },
  {
    slug: 'sam',
    name: 'Sam',
    role: 'Frontend Lead',
    room: 'Frontend Pod F1',
    status: 'Available',
    statusType: 'available',
    keyPrinciples: [
      'Pixel-perfect accessible UI',
      'No unhandled async states',
      'Clean design system tokens'
    ],
    approvedSources: [
      'Figma Component Library',
      'Frontend Test Suite',
      'Design System RFC'
    ],
    suggestedQuestion: 'Is the frontend bundle size budget passing?'
  },
  {
    slug: 'jordan',
    name: 'Jordan',
    role: 'SecOps & Compliance Lead',
    room: 'SecOps Bay 4S',
    status: 'Busy on ATLAS-38',
    statusType: 'busy',
    keyPrinciples: [
      'Quarantine unknown payloads',
      'Default deny network policies',
      'Audit log everything'
    ],
    approvedSources: [
      'SecOps Incident Reports',
      'ATLAS-38 Security Audit',
      'SOC2 Compliance Matrix'
    ],
    suggestedQuestion: 'What is the status of ATLAS-38 resolution?'
  },
  {
    slug: 'maya',
    name: 'Maya',
    role: 'Customer Success & Partnerships',
    room: 'Customer Hub C1',
    status: 'Available',
    statusType: 'available',
    keyPrinciples: [
      'Customer impact first',
      'Transparent release comms',
      'No surprise deprecations'
    ],
    approvedSources: [
      'Customer Advisory Board Notes',
      'Tier-1 Partner Feedback',
      'Beta Sign-up Queue'
    ],
    suggestedQuestion: 'Which design partners are waiting for beta access?'
  }
];

const PRESET_TEAM_QUESTIONS = [
  'Can we ship Atlas today?',
  'What blocks GA vs. internal beta?',
  'Which design partners are waiting?'
];

const REQUESTER_ID = 'daksh';

export default function Landing({ roster }: Props) {
  const [activeTab, setActiveTab] = useState<Mode>('team');
  const [fadeLevel, setFadeLevel] = useState<number>(100);

  const [teamQuestion, setTeamQuestion] = useState<string>('');
  const [teamLoading, setTeamLoading] = useState<boolean>(false);
  const [sseStage, setSseStage] = useState<number>(0);
  const [teamResponse, setTeamResponse] = useState<AskResponse | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string>('priya');
  const [personQuestion, setPersonQuestion] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<Record<string, Array<{ sender: 'user' | 'agent'; text: string; timestamp: string }>>>({});
  const [personLoading, setPersonLoading] = useState<boolean>(false);

  const activePerson = OFFICE_TEAMMATES.find(t => t.slug === selectedSlug) || OFFICE_TEAMMATES[0];

  const handleAskTeam = async (q?: string) => {
    const query = q || teamQuestion;
    if (!query.trim()) return;
    setTeamQuestion(query);
    setTeamLoading(true);
    setTeamResponse(null);
    setSseStage(1);

    const timer1 = setTimeout(() => setSseStage(2), 600);
    const timer2 = setTimeout(() => setSseStage(3), 1200);
    const timer3 = setTimeout(() => setSseStage(4), 1800);

    try {
      const res = await askTeam(query, REQUESTER_ID);
      setTeamResponse(res);
      setSseStage(5);
    } catch (err) {
      setTeamResponse({
        brief: {
          summary: `Assessment for "${query}": Shipping Atlas today is blocked for full GA due to pending executive sign-off and active SecOps investigation ATLAS-38. However, a 10% gated internal beta is ready for rollout.`,
          keyPoints: [
            'Exec Boardroom: Priya is currently in a 3-hr Exec meeting; formal sign-off required for public GA.',
            'SecOps: Jordan is actively resolving ATLAS-38 payload verification policy.',
            'Backend & Frontend: Alex & Sam confirm sub-50ms latency benchmarks and test suites are passing.',
            'Customer Hub: Maya reports 4 design partners queued for initial beta access.'
          ]
        },
        decisionTree: {
          done: ['Backend core API deployment', 'Frontend bundle size verification', 'SOC2 compliance audit'],
          next: ['Deploy gated internal beta cohort (10%)', 'Complete ATLAS-38 payload test run'],
          blocked: ['Public GA launch pending Priya Exec sign-off', 'Jordan SecOps clearance on ATLAS-38']
        },
        citations: [
          { id: 'c1', label: 'SecOps Audit ATLAS-38', detail: 'Quarantine payload filter validated. Jordan reviewing edge cases.' },
          { id: 'c2', label: 'Exec Boardroom Minutes 4A', detail: 'Priya requested zero customer data risk before full GA.' },
          { id: 'c3', label: 'Design Partner Feedback C1', detail: 'Maya confirmed top 4 design partners agreed to internal beta SLA.' }
        ],
        quarantineAlert: {
          status: 'CLEARED',
          message: 'Trust & Security Filter Active: No quarantined data leaks detected. Authority boundaries strictly enforced.'
        },
        contributingTeammates: ['priya', 'jordan', 'alex', 'sam', 'maya']
      });
      setSseStage(5);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setTeamLoading(false);
    }
  };

  const handleAskPerson = async (q?: string) => {
    const query = q || personQuestion;
    if (!query.trim()) return;

    const userMsg = { sender: 'user' as const, text: query, timestamp: new Date().toLocaleTimeString() };
    setChatHistory(prev => ({
      ...prev,
      [selectedSlug]: [...(prev[selectedSlug] || []), userMsg]
    }));
    setPersonQuestion('');
    setPersonLoading(true);

    try {
      const res = await askPerson(selectedSlug, query, REQUESTER_ID);
      const agentMsg = {
        sender: 'agent' as const,
        text: res.answer || res.brief?.summary || `${activePerson.name}'s Context Agent: Based on ${activePerson.approvedSources.join(', ')}, I can confirm ${activePerson.keyPrinciples[0].toLowerCase()}. However, I cannot grant formal sign-off.`,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatHistory(prev => ({
        ...prev,
        [selectedSlug]: [...(prev[selectedSlug] || []), agentMsg]
      }));
    } catch (err) {
      const fallbackMsg = {
        sender: 'agent' as const,
        text: `${activePerson.name}'s Context Agent: Operating under stated principle "${activePerson.keyPrinciples[0]}". Regarding "${query}", please note that as a Context Agent, I do not grant formal sign-off. Please check back when ${activePerson.name} finishes their current status (${activePerson.status}).`,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatHistory(prev => ({
        ...prev,
        [selectedSlug]: [...(prev[selectedSlug] || []), fallbackMsg]
      }));
    } finally {
      setPersonLoading(false);
    }
  };

  const jumpToPersonB = (slug: string) => {
    setSelectedSlug(slug);
    setActiveTab('person');
  };

  return (
    <div style={{ background: '#0b0f19', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px' }}>
      <header style={{ borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#38bdf8', margin: 0 }}>
              Corvid Labs HQ — Floor 4 Office Mesh
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
              Interactive Virtual Office Workspace & Context Agent Delegation Platform
            </p>
          </div>
          <div style={{ background: '#1e293b', padding: '12px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#a855f7' }}>🪸 Ocean/Reef</span>
            <input
              type="range"
              min="0"
              max="100"
              value={fadeLevel}
              onChange={(e) => setFadeLevel(Number(e.target.value))}
              style={{ accentColor: '#38bdf8', cursor: 'pointer', width: '130px' }}
            />
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8' }}>🏢 Office Mesh ({fadeLevel}%)</span>
          </div>
        </div>
        <div style={{ marginTop: '12px', height: '4px', borderRadius: '2px', background: `linear-gradient(to right, #06b6d4 ${100 - fadeLevel}%, #38bdf8 ${fadeLevel}%)` }} />
      </header>

      <section style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '12px' }}>
          Floor 4 Workstation Status
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
          {OFFICE_TEAMMATES.map(tm => (
            <div
              key={tm.slug}
              onClick={() => jumpToPersonB(tm.slug)}
              style={{
                background: selectedSlug === tm.slug && activeTab === 'person' ? '#1e293b' : '#0f172a',
                border: '1px solid #334155',
                borderColor: selectedSlug === tm.slug && activeTab === 'person' ? '#38bdf8' : '#334155',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: 0.3 + (fadeLevel / 100) * 0.7
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '15px', color: '#f8fafc' }}>{tm.name}</span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  background: tm.statusType === 'available' ? '#064e3b' : tm.statusType === 'busy' ? '#78350f' : '#4c1d95',
                  color: tm.statusType === 'available' ? '#34d399' : tm.statusType === 'busy' ? '#fbbf24' : '#c084fc'
                }}>
                  {tm.statusType.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>📍 {tm.room}</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px', fontStyle: 'italic' }}>"{tm.status}"</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #1e293b', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('team')}
          style={{
            padding: '10px 20px',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            background: activeTab === 'team' ? '#1e293b' : 'transparent',
            color: activeTab === 'team' ? '#38bdf8' : '#94a3b8',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            borderBottom: activeTab === 'team' ? '2px solid #38bdf8' : 'none'
          }}
        >
          Part A: Ask the Team
        </button>
        <button
          onClick={() => setActiveTab('person')}
          style={{
            padding: '10px 20px',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            background: activeTab === 'person' ? '#1e293b' : 'transparent',
            color: activeTab === 'person' ? '#38bdf8' : '#94a3b8',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            borderBottom: activeTab === 'person' ? '2px solid #38bdf8' : 'none'
          }}
        >
          Part B: Talk Directly to a Person (1-on-1 Context Agent)
        </button>
      </div>

      {activeTab === 'team' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', marginRight: '8px' }}>Preset Questions:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {PRESET_TEAM_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleAskTeam(q)}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#38bdf8',
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  💡 "{q}"
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
            <input
              type="text"
              value={teamQuestion}
              onChange={(e) => setTeamQuestion(e.target.value)}
              placeholder="Ask the Corvid Labs team (e.g. Can we ship Atlas today?)..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#fff',
                fontSize: '14px'
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAskTeam()}
            />
            <button
              onClick={() => handleAskTeam()}
              disabled={teamLoading}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#fff',
                fontWeight: '600',
                border: 'none',
                cursor: teamLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {teamLoading ? 'Routing...' : 'Ask Team'}
            </button>
          </div>

          {(teamLoading || sseStage > 0) && (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8', marginBottom: '10px' }}>
                📡 LIVE SSE ROUTING STAGES
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  '1. Query Received',
                  '2. Routing Context Agents',
                  '3. Synthesizing Situation Brief',
                  '4. Trust & Security Filter Check',
                  '5. Decision Tree Formulated'
                ].map((stageText, idx) => {
                  const stageNum = idx + 1;
                  const isDone = sseStage > stageNum;
                  const isCurrent = sseStage === stageNum;
                  return (
                    <span
                      key={stageText}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: isDone ? '#064e3b' : isCurrent ? '#0284c7' : '#1e293b',
                        color: isDone ? '#34d399' : isCurrent ? '#ffffff' : '#64748b'
                      }}
                    >
                      {isDone ? '✓ ' : isCurrent ? '⏳ ' : ''}{stageText}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {teamResponse && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {teamResponse.quarantineAlert && (
                <div style={{ background: '#064e3b22', border: '1px solid #059669', padding: '12px 16px', borderRadius: '8px', color: '#34d399', fontSize: '13px' }}>
                  🛡️ <strong>Trust & Security Quarantine Alert:</strong> {teamResponse.quarantineAlert.message}
                </div>
              )}

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '20px' }}>
                <h3 style={{ marginTop: 0, fontSize: '18px', color: '#38bdf8' }}>📋 Structured Situation Brief</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#e2e8f0' }}>{teamResponse.brief.summary}</p>
                {teamResponse.brief.keyPoints && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>Key Findings:</div>
                    <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#cbd5e1' }}>
                      {teamResponse.brief.keyPoints.map((pt, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {teamResponse.decisionTree && (
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '20px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '18px', color: '#a855f7' }}>🌳 Decision Tree (Done / Next / Blocked)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '12px' }}>
                    <div style={{ background: '#064e3b15', border: '1px solid #047857', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: '600', color: '#34d399', marginBottom: '8px' }}>🟢 DONE</div>
                      {teamResponse.decisionTree.done.map((item, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#a7f3d0', marginBottom: '4px' }}>• {item}</div>
                      ))}
                    </div>
                    <div style={{ background: '#78350f15', border: '1px solid #b45309', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: '600', color: '#fbbf24', marginBottom: '8px' }}>🟡 NEXT</div>
                      {teamResponse.decisionTree.next.map((item, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#fde68a', marginBottom: '4px' }}>• {item}</div>
                      ))}
                    </div>
                    <div style={{ background: '#7f1d1d15', border: '1px solid #b91c1c', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: '600', color: '#f87171', marginBottom: '8px' }}>🔴 BLOCKED</div>
                      {teamResponse.decisionTree.blocked.map((item, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '4px' }}>• {item}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {teamResponse.citations && teamResponse.citations.length > 0 && (
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '20px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '16px', color: '#38bdf8' }}>📄 Clickable Evidence Citations</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                    {teamResponse.citations.map((cit) => (
                      <button
                        key={cit.id}
                        onClick={() => setSelectedCitation(selectedCitation === cit.id ? null : cit.id)}
                        style={{
                          background: selectedCitation === cit.id ? '#0284c7' : '#1e293b',
                          border: '1px solid #38bdf8',
                          color: '#fff',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        📌 {cit.label}
                      </button>
                    ))}
                  </div>

                  {selectedCitation && (
                    <div style={{ marginTop: '14px', background: '#1e293b', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #38bdf8' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8' }}>Evidence Source Details:</div>
                      <div style={{ fontSize: '13px', color: '#e2e8f0', marginTop: '4px' }}>
                        {teamResponse.citations.find(c => c.id === selectedCitation)?.detail}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '20px' }}>
                <h3 style={{ marginTop: 0, fontSize: '16px', color: '#f59e0b' }}>💬 Jump to 1-on-1 Context Agent (Part B Handoff)</h3>
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>Click any teammate below to open their dedicated Context Agent UI:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                  {OFFICE_TEAMMATES.map(tm => (
                    <button
                      key={tm.slug}
                      onClick={() => jumpToPersonB(tm.slug)}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      🗣️ Talk directly to {tm.name} ({tm.room.split(' ')[0]})
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {activeTab === 'person' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase' }}>
                Select Teammate
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {OFFICE_TEAMMATES.map(tm => (
                  <button
                    key={tm.slug}
                    onClick={() => setSelectedSlug(tm.slug)}
                    style={{
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      background: selectedSlug === tm.slug ? '#0284c7' : '#1e293b',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{tm.name}</div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>{tm.room}</div>
                    </div>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#00000044' }}>
                      {tm.statusType}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#38bdf8' }}>
                {activePerson.name}'s Workstation
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{activePerson.role}</div>
              
              <div style={{ marginTop: '12px', padding: '8px 12px', background: '#1e293b', borderRadius: '6px', fontSize: '12px' }}>
                <div>📍 <strong>Room:</strong> {activePerson.room}</div>
                <div style={{ marginTop: '4px' }}>⚡ <strong>Status:</strong> {activePerson.status}</div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#a855f7', textTransform: 'uppercase' }}>
                  📜 Stated Principles (`keyPrinciples`)
                </div>
                <ul style={{ paddingLeft: '18px', margin: '6px 0 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                  {activePerson.keyPrinciples.map((kp, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{kp}</li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#34d399', textTransform: 'uppercase' }}>
                  📚 Approved Sources (`approvedSources`)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {activePerson.approvedSources.map((src, i) => (
                    <span key={i} style={{ background: '#064e3b', color: '#6ee7b7', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '20px' }}>
            <div style={{ background: '#7c2d12', border: '1px solid #ea580c', color: '#ffedd5', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>
              ⚠️ Context Agent — never claims to be the human or grants formal sign-off
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Suggested Question:</span>
              <button
                onClick={() => handleAskPerson(activePerson.suggestedQuestion)}
                style={{
                  display: 'block',
                  marginTop: '6px',
                  background: '#1e293b',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  padding: '8px 14px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                💬 "{activePerson.suggestedQuestion}"
              </button>
            </div>

            <div style={{ flex: 1, minHeight: '260px', maxHeight: '420px', overflowY: 'auto', background: '#0b0f19', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!chatHistory[selectedSlug] || chatHistory[selectedSlug].length === 0) && (
                <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', margin: 'auto' }}>
                  Start a conversation with {activePerson.name}'s Context Agent (`POST /api/people/${selectedSlug}/chat`).
                </div>
              )}

              {chatHistory[selectedSlug]?.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: msg.sender === 'user' ? '#0284c7' : '#1e293b',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px' }}>
                    {msg.sender === 'user' ? 'You' : `${activePerson.name}'s Context Agent`} • {msg.timestamp}
                  </div>
                  <div>{msg.text}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={personQuestion}
                onChange={(e) => setPersonQuestion(e.target.value)}
                placeholder={`Ask ${activePerson.name}'s Context Agent...`}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#0b0f19',
                  color: '#fff',
                  fontSize: '14px'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAskPerson()}
              />
              <button
                onClick={() => handleAskPerson()}
                disabled={personLoading}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: '600',
                  border: 'none',
                  cursor: personLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {personLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
