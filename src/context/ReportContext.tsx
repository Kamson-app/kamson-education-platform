/** * @license * SPDX-License-Identifier: Apache-2.0 */
import React,{createContext,useContext,useState,useEffect,useCallback}from "react";
import type{CouncilReport,CouncilResolution}from "../types";
import type{DepartmentGlobalStatistics}from "../types/report/DepartmentStatistics";
import{reportStorageService}from "../services/report/reportStorageService";
import{reportPdfService}from "../services/report/reportPdfService";
import{reportAIService}from "../services/report/reportAIService";
import type{GenerateReportAIParams}from "../services/report/reportAIService";
import {generateAIResolutions,} from "../utils/reportResolutions";

export interface ReportContextType{
currentReport:CouncilReport|null;
historicalReports:CouncilReport[];
isSaving:boolean;
isGeneratingAI:boolean;
saveStatus:{type:"success"|"error"|null;message:string;};
setSaveStatus:React.Dispatch<React.SetStateAction<{type:"success"|"error"|null;message:string;}> >;
loadReport:(report:CouncilReport,statistics?:DepartmentGlobalStatistics)=>void;
saveReport:(report:CouncilReport)=>Promise<void>;
exportPDF:(report:CouncilReport)=>void;
generateAIAnalysis:(params:GenerateReportAIParams)=>Promise<any>;
addResolution:()=>void;
updateResolution:(id:string,text:string)=>void;
deleteResolution:(id:string)=>void;
regenerateResolutions:(statistics:DepartmentGlobalStatistics)=>void;
}

const ReportContext=createContext<ReportContextType|undefined>(undefined);

export const ReportProvider:React.FC<{children:React.ReactNode;}>=({children})=>{
const [currentReport,setCurrentReport]=useState<CouncilReport|null>(null);
const [historicalReports,setHistoricalReports]=useState<CouncilReport[]>([]);
const [isSaving,setIsSaving]=useState(false);
const [isGeneratingAI,setIsGeneratingAI]=useState(false);
const [saveStatus,setSaveStatus]=useState<{type:"success"|"error"|null;message:string;}>({type:null,message:"",});

useEffect(()=>{
const loadHistory=async()=>{
try{
const reports=await reportStorageService.getReports();
setHistoricalReports(reports);
}catch(err){
console.error(err);
}
};
loadHistory();
},[]);

const loadReport = useCallback(
  async (
    report: CouncilReport,
    statistics?: DepartmentGlobalStatistics
  ) => {

    let resolutions = report.councilResolutions ?? [];

    if (resolutions.length === 0 && statistics) {

      const result = await generateAIResolutions(statistics);

      resolutions = result?.resolutions ?? [];
    }

    setCurrentReport({
      ...report,
      councilResolutions: resolutions,
    });

  },
  []
);

const saveReport=useCallback(async(report:CouncilReport)=>{
setIsSaving(true);
setSaveStatus({type:null,message:"",});
try{
await reportStorageService.saveReport(report);
const reports=await reportStorageService.getReports();
setHistoricalReports(reports);
setCurrentReport(report);
setSaveStatus({type:"success",message:"Le rapport trimestriel a été enregistré avec succès.",});
}catch(error){
console.error(error);
setSaveStatus({type:"error",message:"Une erreur est survenue lors de la sauvegarde du rapport.",});
throw error;
}finally{
setIsSaving(false);
}
},[]);

const exportPDF=useCallback((report:CouncilReport)=>{
try{
reportPdfService.exportToPDF(report);
}catch(error){
console.error(error);
setSaveStatus({type:"error",message:"Impossible d'exporter le rapport en PDF.",});
}
},[]);

const generateAIAnalysis=useCallback(async(params:GenerateReportAIParams)=>{
setIsGeneratingAI(true);
setSaveStatus({type:null,message:"",});
try{
const response=await reportAIService.generateReportAnalysis(params);
setSaveStatus({type:"success",message:"Analyse générée avec succès par l'IA.",});
return response;
}catch(error){
console.error(error);
setSaveStatus({type:"error",message:"Erreur lors de la génération du rapport IA.",});
throw error;
}finally{
setIsGeneratingAI(false);
}
},[]);

const addResolution=useCallback(()=>{
setCurrentReport(prev=>{
if(!prev)return prev;
const resolution:CouncilResolution={
id:typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():`resolution_${Date.now()}`,
text:"Nouvelle résolution",
origin:"USER",
editable:true,
createdAt:new Date().toISOString(),
};
return{...prev,councilResolutions:[...(prev.councilResolutions??[]),resolution,],};
});
},[]);

const updateResolution=useCallback((id:string,text:string)=>{
setCurrentReport(prev=>{
if(!prev)return prev;
return{...prev,councilResolutions:(prev.councilResolutions??[]).map(resolution=>resolution.id===id?{...resolution,text,}:resolution),};
});
},[]);

const deleteResolution=useCallback((id:string)=>{
setCurrentReport(prev=>{
if(!prev)return prev;
return{...prev,councilResolutions:(prev.councilResolutions??[]).filter(resolution=>resolution.id!==id),};
});
},[]);

const regenerateResolutions = useCallback(
  async (statistics: DepartmentGlobalStatistics) => {
    const result = await generateAIResolutions(statistics);

    const resolutions = result?.resolutions ?? [];

    setCurrentReport(prev =>
      prev
        ? {
            ...prev,
            councilResolutions: resolutions,
          }
        : null
    );
  },
  []
);

return(
<ReportContext.Provider value={{currentReport,historicalReports,isSaving,isGeneratingAI,saveStatus,setSaveStatus,loadReport,saveReport,exportPDF,generateAIAnalysis,addResolution,updateResolution,deleteResolution,regenerateResolutions,}}>
{children}
</ReportContext.Provider>
);
};

export const useReport=():ReportContextType=>{
const context=useContext(ReportContext);
if(!context){
throw new Error("useReport doit être utilisé à l'intérieur d'un ReportProvider.");
}
return context;
};

export const useCouncilReport=useReport;

export default ReportContext;