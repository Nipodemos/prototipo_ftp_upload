import * as fs from 'node:fs';
import * as path from 'node:path';
import { Writable } from 'node:stream';
import { Client } from 'basic-ftp';

interface FtpConnectionOptions {
	host: string;
	port: number;
	username: string;
	password: string;
	timeoutMs?: number;
}

export interface FtpDownloadOptions extends FtpConnectionOptions {
	remoteFilePath: string;
	localFilePath: string;
}

export interface FtpUploadOptions extends FtpConnectionOptions {
	localFilePath: string;
	remoteFilePath: string;
}

export interface FtpReadOptions extends FtpConnectionOptions {
	remoteFilePath: string;
	encoding?: BufferEncoding;
}

export class FTPClient {
	private readonly client: Client;

	constructor(timeoutMs: number) {
		this.client = new Client(timeoutMs);
	}

	public async connect(host: string, port: number, username: string, password: string): Promise<void> {
		await this.client.access({
			host,
			port,
			user: username,
			password,
			secure: false
		});
	}

	public async downloadFile(remoteFilePath: string, localFilePath: string): Promise<void> {
		await this.client.downloadTo(localFilePath, remoteFilePath);
	}

	public async uploadFile(localFilePath: string, remoteFilePath: string): Promise<void> {
		await this.client.ensureDir(path.posix.dirname(remoteFilePath));
		await this.client.uploadFrom(localFilePath, remoteFilePath);
	}

	public async downloadFileContent(remoteFilePath: string): Promise<Buffer> {
		const chunks: Buffer[] = [];
		const writable = new Writable({
			write: (chunk, _encoding, callback) => {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				callback();
			}
		});

		await this.client.downloadTo(writable, remoteFilePath);
		return Buffer.concat(chunks);
	}

	public close(): void {
		this.client.close();
	}
}

export async function downloadFileFromFtp(options: FtpDownloadOptions): Promise<void> {
	const timeoutMs = options.timeoutMs ?? 15000;
	const client = new FTPClient(timeoutMs);

	try {
		await fs.promises.mkdir(path.dirname(options.localFilePath), { recursive: true });

		await client.connect(options.host, options.port, options.username, options.password);
		await client.downloadFile(options.remoteFilePath, options.localFilePath);
	} finally {
		client.close();
	}
}

export async function uploadFileToFtp(options: FtpUploadOptions): Promise<void> {
	const timeoutMs = options.timeoutMs ?? 15000;
	const client = new FTPClient(timeoutMs);

	try {
		await client.connect(options.host, options.port, options.username, options.password);
		await client.uploadFile(options.localFilePath, options.remoteFilePath);
	} finally {
		client.close();
	}
}

export async function downloadFileContentFromFtp(options: FtpReadOptions): Promise<string> {
	const timeoutMs = options.timeoutMs ?? 15000;
	const client = new FTPClient(timeoutMs);

	try {
		await client.connect(options.host, options.port, options.username, options.password);
		const content = await client.downloadFileContent(options.remoteFilePath);
		return content.toString(options.encoding ?? 'utf8');
	} finally {
		client.close();
	}
}
