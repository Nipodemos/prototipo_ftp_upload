import * as vscode from 'vscode';
import * as path from 'node:path';
import {
	getDefaultFtpServer,
	getDefaultFtpServerName,
	type FtpServerConfig,
	validateDefaultFtpServer,
	validateFtpServer
} from '../config';

export function getTargetFileUri(resource?: vscode.Uri): vscode.Uri | undefined {
	if (resource?.scheme === 'file') {
		return resource;
	}

	const activeUri = vscode.window.activeTextEditor?.document.uri;
	if (activeUri?.scheme === 'file') {
		return activeUri;
	}

	return undefined;
}

export function toRemotePath(localFileUri: vscode.Uri, remoteBasePath: string): string {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(localFileUri);
	const localFilePath = localFileUri.fsPath;
	const localRelativePath = workspaceFolder
		? path.relative(workspaceFolder.uri.fsPath, localFilePath)
		: path.basename(localFilePath);

	const relativePosix = localRelativePath.split(path.sep).join('/');
	const normalizedBase = remoteBasePath.replace(/\\/g, '/').replace(/\/+$/, '') || '/';

	if (relativePosix === '') {
		return normalizedBase;
	}

	return path.posix.join(normalizedBase, relativePosix);
}

export function validateServerOrShow(server: FtpServerConfig): boolean {
	const validationErrors = validateFtpServer(server);
	if (validationErrors.length > 0) {
		vscode.window.showErrorMessage(`Servidor "${server.name || '(sem nome)'}": ${validationErrors.join(', ')}`);
		return false;
	}

	if (server.protocol !== 'ftp') {
		vscode.window.showErrorMessage(
			`Protocolo "${server.protocol}" ainda não suportado no download. Use um servidor com protocolo "ftp".`
		);
		return false;
	}

	return true;
}

export function validateServersOrShow(servers: FtpServerConfig[], stopOnFirstError: boolean): boolean {
	let hasErrors = false;

	for (const server of servers) {
		const errors = validateFtpServer(server);
		if (errors.length === 0) {
			continue;
		}

		hasErrors = true;
		vscode.window.showErrorMessage(`Servidor "${server.name || '(sem nome)'}": ${errors.join(', ')}`);
		if (stopOnFirstError) {
			return false;
		}
	}

	return !hasErrors;
}

export async function pickServer(
	servers: FtpServerConfig[],
	placeholder: string,
	title?: string
): Promise<FtpServerConfig | undefined> {
	const defaultServerName = getDefaultFtpServerName();
	const selected = await vscode.window.showQuickPick(
		servers.map(server => ({
			label: server.name,
			description: `${server.protocol}://${server.host}:${server.port}`,
			detail: `${server.remotePath}${server.name === defaultServerName ? ' (Padrão)' : ''}`,
			server
		})),
		{
			placeHolder: placeholder,
			title
		}
	);

	return selected?.server;
}

export function getDefaultServerOrShow(): FtpServerConfig | undefined {
	const defaultErrors = validateDefaultFtpServer();
	if (defaultErrors.length > 0) {
		vscode.window.showErrorMessage(defaultErrors.join(' '));
		return undefined;
	}

	const defaultServer = getDefaultFtpServer();
	if (!defaultServer) {
		vscode.window.showWarningMessage(
			'Nenhum servidor padrão configurado. Defina "ftpUpload.defaultServer" no settings.json.'
		);
		return undefined;
	}

	return defaultServer;
}
