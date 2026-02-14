import * as vscode from 'vscode';
import * as path from 'node:path';
import {
	getDefaultFtpServer,
	getDefaultFtpServerName,
	getFtpServers,
	type FtpServerConfig,
	validateDefaultFtpServer,
	validateFtpServer
} from './config';
import { downloadFileFromFtp } from './ftpClient';

function getTargetFileUri(resource?: vscode.Uri): vscode.Uri | undefined {
	if (resource?.scheme === 'file') {
		return resource;
	}

	const activeUri = vscode.window.activeTextEditor?.document.uri;
	if (activeUri?.scheme === 'file') {
		return activeUri;
	}

	return undefined;
}

function toRemotePath(localFileUri: vscode.Uri, remoteBasePath: string): string {
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

function validateServerOrShow(server: FtpServerConfig): boolean {
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

function validateServersOrShow(servers: FtpServerConfig[], stopOnFirstError: boolean): boolean {
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

function toServerQuickPickItems(servers: FtpServerConfig[]) {
	const defaultServerName = getDefaultFtpServerName();
	return servers.map(server => ({
		label: server.name,
		description: `${server.protocol}://${server.host}:${server.port}`,
		detail: `${server.remotePath}${server.name === defaultServerName ? ' (Padrão)' : ''}`,
		server
	}));
}

async function pickServer(
	servers: FtpServerConfig[],
	placeholder: string,
	title?: string
): Promise<FtpServerConfig | undefined> {
	const selected = await vscode.window.showQuickPick(toServerQuickPickItems(servers), {
		placeHolder: placeholder,
		title
	});

	return selected?.server;
}

async function downloadSelectedFileFromServer(
	server: FtpServerConfig,
	resource?: vscode.Uri
): Promise<void> {
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

	const activeDoc = vscode.window.activeTextEditor?.document;
	if (activeDoc && activeDoc.uri.toString() === targetUri.toString() && activeDoc.isDirty) {
		const choice = await vscode.window.showWarningMessage(
			'O arquivo atual tem alterações não salvas e será sobrescrito pelo download. Continuar?',
			'Continuar'
		);
		if (choice !== 'Continuar') {
			return;
		}
	}

	const remoteFilePath = toRemotePath(targetUri, server.remotePath);

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `FTP: baixando ${path.basename(targetUri.fsPath)} de ${server.name}`
		},
		async () => {
			await downloadFileFromFtp({
				host: server.host,
				port: server.port,
				username: server.username,
				password: server.password,
				remoteFilePath,
				localFilePath: targetUri.fsPath
			});
		}
	);

	vscode.window.showInformationMessage(
		`Download concluído: ${server.name} -> ${path.basename(targetUri.fsPath)}`
	);
}

function getDefaultServerOrShow(): FtpServerConfig | undefined {
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

async function executeDownloadCommand(
	server: FtpServerConfig,
	resource: vscode.Uri | undefined,
	errorPrefix: string
): Promise<void> {
	try {
		await downloadSelectedFileFromServer(server, resource);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`${errorPrefix}: ${message}`);
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Extensão "FTP Upload" ativa!');

	const listServersCmd = vscode.commands.registerCommand('ftpUpload.listServers', async () => {
		const servers = getFtpServers();
		if (servers.length === 0) {
			const openSettings = 'Abrir Settings';
			const choice = await vscode.window.showWarningMessage(
				'Nenhum servidor FTP configurado. Configure em Settings > FTP Upload.',
				openSettings
			);
			if (choice === openSettings) {
				vscode.commands.executeCommand('workbench.action.openSettings', 'ftpUpload.servers');
			}
			return;
		}

		if (!validateServersOrShow(servers, false)) {
			return;
		}

		const defaultErrors = validateDefaultFtpServer();
		if (defaultErrors.length > 0) {
			vscode.window.showErrorMessage(defaultErrors.join(' '));
			return;
		}

		const selectedServer = await pickServer(
			servers,
			'Selecione um servidor FTP',
			'Servidores FTP Configurados'
		);
		if (!selectedServer) {
			return;
		}

		vscode.window.showInformationMessage(
			`Servidor selecionado: ${selectedServer.name} (${selectedServer.host})`
		);
	});

	const downloadDefaultCmd = vscode.commands.registerCommand(
		'ftpUpload.downloadDefault',
		async (resource?: vscode.Uri) => {
			const defaultServer = getDefaultServerOrShow();
			if (!defaultServer) {
				return;
			}

			await executeDownloadCommand(defaultServer, resource, 'Falha no download FTP padrão');
		}
	);

	const downloadSelectCmd = vscode.commands.registerCommand(
		'ftpUpload.downloadSelect',
		async (resource?: vscode.Uri) => {
			const servers = getFtpServers();
			if (servers.length === 0) {
				vscode.window.showWarningMessage(
					'Nenhum servidor FTP configurado. Configure "ftpUpload.servers" no settings.json.'
				);
				return;
			}

			if (!validateServersOrShow(servers, true)) {
				return;
			}

			const selectedServer = await pickServer(servers, 'Selecione o servidor FTP para download');
			if (!selectedServer) {
				return;
			}

			await executeDownloadCommand(selectedServer, resource, 'Falha no download FTP');
		}
	);

	const uploadDefaultCmd = vscode.commands.registerCommand('ftpUpload.uploadDefault', async () => {
		const defaultServer = getDefaultServerOrShow();
		if (!defaultServer) {
			return;
		}

		vscode.window.showInformationMessage(`Upload para FTP padrão (em breve): ${defaultServer.name}`);
	});

	const uploadSelectCmd = vscode.commands.registerCommand('ftpUpload.uploadSelect', async () => {
		vscode.window.showInformationMessage('Upload para FTP... (em breve).');
	});

	context.subscriptions.push(
		listServersCmd,
		downloadDefaultCmd,
		downloadSelectCmd,
		uploadDefaultCmd,
		uploadSelectCmd
	);
}

export function deactivate() {}
