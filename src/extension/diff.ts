import * as vscode from 'vscode';
import * as path from 'node:path';
import type { FtpServerConfig } from '../config';
import { downloadFileContentFromFtp } from '../ftpClient';
import { getTargetFileUri, toRemotePath, validateServerOrShow } from './shared';

export const REMOTE_DIFF_SCHEME = 'ftp-upload-remote';

export interface RemoteDiffSnapshot {
	content: string;
	server: FtpServerConfig;
	remoteFilePath: string;
	localFileUri: vscode.Uri;
}

const remoteDiffSnapshots = new Map<string, RemoteDiffSnapshot>();

export function getRemoteDiffSnapshot(remoteUri: vscode.Uri): RemoteDiffSnapshot | undefined {
	return remoteDiffSnapshots.get(remoteUri.toString());
}

export function registerRemoteDiffProvider(context: vscode.ExtensionContext): void {
	const remoteDiffProvider = vscode.workspace.registerTextDocumentContentProvider(REMOTE_DIFF_SCHEME, {
		provideTextDocumentContent(uri: vscode.Uri): string {
			const snapshot = remoteDiffSnapshots.get(uri.toString());
			return snapshot?.content ?? '';
		}
	});

	const closeRemoteDiffDocListener = vscode.workspace.onDidCloseTextDocument(document => {
		if (document.uri.scheme !== REMOTE_DIFF_SCHEME) {
			return;
		}

		remoteDiffSnapshots.delete(document.uri.toString());
	});

	context.subscriptions.push(remoteDiffProvider, closeRemoteDiffDocListener);
}

export async function openDiffAgainstServer(server: FtpServerConfig, resource?: vscode.Uri): Promise<void> {
	if (!validateServerOrShow(server)) {
		return;
	}

	const targetUri = getTargetFileUri(resource);
	if (!targetUri) {
		vscode.window.showWarningMessage(
			'Nenhum arquivo local selecionado no editor. Abra ou selecione um arquivo e tente novamente.'
		);
		return;
	}

	const remoteFilePath = toRemotePath(targetUri, server.remotePath);
	const localName = path.basename(targetUri.fsPath);

	let remoteContent = '';
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `FTP: comparando ${localName} com ${server.name}`
		},
		async () => {
			remoteContent = await downloadFileContentFromFtp({
				host: server.host,
				port: server.port,
				username: server.username,
				password: server.password,
				remoteFilePath
			});
		}
	);

	const remoteUri = vscode.Uri.from({
		scheme: REMOTE_DIFF_SCHEME,
		path: `/${localName}`,
		query: `server=${encodeURIComponent(server.name)}&remote=${encodeURIComponent(remoteFilePath)}&t=${Date.now()}`
	});

	remoteDiffSnapshots.set(remoteUri.toString(), {
		content: remoteContent,
		server,
		remoteFilePath,
		localFileUri: targetUri
	});

	await vscode.commands.executeCommand(
		'vscode.diff',
		targetUri,
		remoteUri,
		`FTP Diff: ${localName} (${server.name})`,
		{ preview: false }
	);
}

export async function executeDiffCommand(
	server: FtpServerConfig,
	resource: vscode.Uri | undefined,
	errorPrefix: string
): Promise<void> {
	try {
		await openDiffAgainstServer(server, resource);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`${errorPrefix}: ${message}`);
	}
}
