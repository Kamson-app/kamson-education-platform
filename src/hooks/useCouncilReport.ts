/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useReport } from '../context/ReportContext';

export const useCouncilReport = () => {
  const context = useReport();
  return context;
};

export default useCouncilReport;