import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import fetch from 'node-fetch'; // For making a request to the origin
import * as HLS from 'hls-parser'; // For reading/writing the HLS manifest

const client = new SNSClient({ region: process.env.REGION });
const MASTER_PLAYLIST_URL = process.env.MASTER_PLAYLIST_URL as string;
const CHANNEL_START_TIME = Number.parseInt(process.env.CHANNEL_START_TIME as string);
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN as string;

// Lambda function to wtich inputs using the MediaLive schedule API
export async function handler() {
  const url = addStartParam(MASTER_PLAYLIST_URL, MASTER_PLAYLIST_URL.includes('mediapackagev2') ? 'ISO8601' : 'POSIX');
  console.log(`Fetching the master playlist: ${url}`)
  const renditions = await getAVRenditions(url);
  if (!renditions) {
    console.error('Failed to fetch both renditions');
    return;
  }
  const [video, audio] = renditions;
  if (!video || !audio) {
    console.error('Failed to fetch either video or audio rendition');
    return;
  }
  if (compareDiscontinuity(video as HLS.types.MediaPlaylist, audio as HLS.types.MediaPlaylist) === false) {
    const message = trimMessage(`
      ==========
      Playlist URL: ${MASTER_PLAYLIST_URL}
      ----------
      ${video.source}
      ----------
      ${audio.source}
      ----------
    `);
    const command = new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: 'Discontinuity mismatch detected',
      Message: message,
    });
    const response = await client.send(command);
    console.log(`[FAIL] Audio and video renditions have different amount of DISCONTINUITY`);
    console.log(message);
    console.log(`SNS message sent: ${response.MessageId}`);
    return;
  }
  console.log('[PASS] Audio and video renditions have the same amount of DISCONTINUITY');
}

function trimMessage(msg: string): string {
  return msg.trim().replace(/\n\n|\n\s*/g, '\n');
}

async function getAVRenditions(url: string): Promise<(HLS.types.Playlist | undefined)[] | undefined> {
  const playlist = await getPlaylist(url);
  if (!playlist || !playlist.isMasterPlaylist) {
    console.error('Failed to fetch the master playlist');
    return undefined;
  }
  const masterPlaylist = playlist as HLS.types.MasterPlaylist;
  if (masterPlaylist.variants.length === 0) {
    console.error('No variant found in the master playlist');
    return undefined;
  }
  if (masterPlaylist.variants[0].audio.length === 0) {
    console.error('No audio rendition found in the master playlist');
    return undefined;
  }
  const videoUrl = getAbsoluteUrl(url, masterPlaylist.variants[0].uri);
  const audioUrl = getAbsoluteUrl(url, masterPlaylist.variants[0].audio[0].uri as string);
  const videoRendition = await getPlaylist(videoUrl);
  const audioRendition = await getPlaylist(audioUrl);
  return [videoRendition, audioRendition];
}

function getAbsoluteUrl(parent: string, current: string): string {
  try {
    const url = new URL(current, parent);
    return url.href;
  } catch (e) {
    console.error(`Failed to parse the URL: ${parent} - ${current}`)
  }
  return current;
}

async function getPlaylist(url: string): Promise<HLS.types.Playlist | undefined> {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch the HLS manifest: ${res.status} ${res.statusText} - ${url}`)
    return undefined;
  }
  // Parse the HLS manifest
  return HLS.parse(await res.text());
}

function compareDiscontinuity(playlistA: HLS.types.MediaPlaylist, playlistB: HLS.types.MediaPlaylist): boolean {
  let  countA = playlistA.discontinuitySequenceBase || 0;
  let  countB = playlistB.discontinuitySequenceBase || 0;
  for (let i = 0; i < playlistA.segments.length && i < playlistB.segments.length && countA === countB; i++) {
    countA += (playlistA.segments[i].discontinuity ? 1 : 0);
    countB += (playlistB.segments[i].discontinuity ? 1 : 0);
  }
  console.log(`Discontinuity Count: Video: ${countA}, Audio: ${countB}`);
  return countA === countB;
}

function addStartParam(url: string, format: 'POSIX' | 'ISO8601'): string {
  const startTime = getRandomInt(CHANNEL_START_TIME, Math.floor(Date.now() / 1000 - 30));
  return `${url}${url.includes('?') ? '&' : '?'}start=${format === 'ISO8601' ? new Date(startTime * 1000).toISOString() : startTime}`;
}

function getRandomInt(min: number, max: number): number {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}