import * as vscode from 'vscode';
import * as path from 'node:path';
import type { FtpServerConfig } from '../config';
import { downloadFileFromFtp } from '../ftpClient';
import { getTargetFileUri, toRemotePath, validateServerOrShow } from './shared';

export async function downloadSelectedFileFromServer(
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

	const targetDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === targetUri.toString());
	if (targetDoc?.isDirty) {
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

	vscode.window.showInformationMessage(`Download concluído: ${server.name} -> ${path.basename(targetUri.fsPath)}`);
}

export async function executeDownloadCommand(
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
